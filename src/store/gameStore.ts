import { create } from 'zustand';
import { DEFAULT_WORDS } from '../data/defaultWords';
import { evaluateAnswer } from '../lib/answer';
import { appendSpecialCharacter } from '../lib/germanInput';
import { computeMasteryLevel, computeNextReviewDate } from '../lib/review';
import {
  appendSessionHistory,
  loadGameSettings,
  loadImportedWords,
  loadWordProgressMap,
  saveGameSettings,
  saveWordProgressMap
} from '../lib/storage';
import { commitWords, parseJsonWords, validateWords } from '../lib/wordImport';
import type {
  Difficulty,
  GameAnswer,
  GameFeedback,
  GamePhase,
  GameSession,
  GameSettings,
  ImportResult,
  Word,
  WordProgress
} from '../types';

const DEFAULT_SETTINGS: GameSettings = {
  sessionSize: 20,
  difficulty: 'mixed',
  autoReplace: true,
  feedbackDelayMs: 1500
};

const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const shuffle = <T>(list: T[]): T[] => {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

const mergeWords = (builtins: Word[], imported: Word[]): Word[] => {
  const map = new Map<string, Word>();
  builtins.forEach((word) => map.set(word.id, word));
  imported.forEach((word) => map.set(word.id, word));
  return Array.from(map.values());
};

const pickWords = (allWords: Word[], settings: GameSettings): Word[] => {
  const filtered =
    settings.difficulty === 'mixed'
      ? allWords
      : allWords.filter((word) => word.difficulty === settings.difficulty);

  const source = filtered.length > 0 ? filtered : allWords;
  return shuffle(source).slice(0, Math.max(5, Math.min(settings.sessionSize, 50)));
};

const updateWordProgress = (
  oldProgress: Record<string, WordProgress>,
  wordId: string,
  isCorrect: boolean,
  responseTime: number,
  userInput: string,
  correctAnswer: string
): Record<string, WordProgress> => {
  const now = new Date();
  const prev = oldProgress[wordId];
  const attempts = (prev?.attempts ?? 0) + 1;
  const correct = (prev?.correct ?? 0) + (isCorrect ? 1 : 0);
  const averageResponseTime =
    ((prev?.averageResponseTime ?? 0) * (attempts - 1) + responseTime) / attempts;
  const masteryLevel = computeMasteryLevel(attempts, correct);

  const next: WordProgress = {
    wordId,
    attempts,
    correct,
    averageResponseTime,
    masteryLevel,
    lastReviewDate: now.toISOString(),
    nextReviewDate: computeNextReviewDate(masteryLevel, now),
    errorPatterns: isCorrect
      ? prev?.errorPatterns ?? []
      : [...(prev?.errorPatterns ?? []), `${userInput} => ${correctAnswer}`].slice(-10)
  };

  return {
    ...oldProgress,
    [wordId]: next
  };
};

interface GameState {
  isInitialized: boolean;
  allWords: Word[];
  session: GameSession | null;
  answers: GameAnswer[];
  phase: GamePhase;
  feedback: GameFeedback | null;
  currentInput: string;
  wordStartedAtMs: number;
  wordProgressMap: Record<string, WordProgress>;
  importReport: ImportResult | null;
  settings: GameSettings;
  initializeGame: () => void;
  startSession: () => void;
  setInput: (value: string) => void;
  appendSpecialChar: (char: string) => void;
  submitAnswer: () => void;
  skipWord: () => void;
  nextWord: () => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  importWordsFromJsonText: (raw: string) => void;
  clearImportReport: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  isInitialized: false,
  allWords: DEFAULT_WORDS,
  session: null,
  answers: [],
  phase: 'typing',
  feedback: null,
  currentInput: '',
  wordStartedAtMs: Date.now(),
  wordProgressMap: {},
  importReport: null,
  settings: DEFAULT_SETTINGS,

  initializeGame: () => {
    const imported = loadImportedWords();
    const mergedWords = mergeWords(DEFAULT_WORDS, imported);
    const settings = loadGameSettings(DEFAULT_SETTINGS);
    const wordProgressMap = loadWordProgressMap();

    set({
      isInitialized: true,
      allWords: mergedWords,
      settings,
      wordProgressMap
    });

    get().startSession();
  },

  startSession: () => {
    const { allWords, settings } = get();
    const wordsInSession = pickWords(allWords, settings);

    const session: GameSession = {
      id: generateSessionId(),
      startTime: new Date().toISOString(),
      gameMode: 'sausage_cutting',
      difficulty: settings.difficulty,
      wordsInSession,
      currentWordIndex: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      averageTimePerWord: 0,
      isCompleted: false
    };

    set({
      session,
      answers: [],
      phase: 'typing',
      feedback: null,
      currentInput: '',
      wordStartedAtMs: Date.now()
    });
  },

  setInput: (value) => set({ currentInput: value }),

  appendSpecialChar: (char) => {
    const current = get().currentInput;
    set({ currentInput: appendSpecialCharacter(current, char) });
  },

  submitAnswer: () => {
    const { session, currentInput, answers, wordProgressMap, wordStartedAtMs, phase } = get();

    if (!session || session.isCompleted || phase !== 'typing') {
      return;
    }

    const currentWord = session.wordsInSession[session.currentWordIndex];
    if (!currentWord) {
      return;
    }

    const now = Date.now();
    const responseTime = (now - wordStartedAtMs) / 1000;
    const evaluation = evaluateAnswer(currentInput, currentWord.german);

    const nextAnswer: GameAnswer = {
      sessionId: session.id,
      wordId: currentWord.id,
      userInput: currentInput.trim(),
      correctAnswer: currentWord.german,
      isCorrect: evaluation.isCorrect,
      responseTime,
      timestamp: new Date(now).toISOString(),
      feedbackType: evaluation.isCorrect ? 'correct' : 'wrong'
    };

    const totalAnswers = session.totalAnswers + 1;
    const correctAnswers = session.correctAnswers + (evaluation.isCorrect ? 1 : 0);
    const averageTimePerWord =
      (session.averageTimePerWord * session.totalAnswers + responseTime) / totalAnswers;

    const updatedSession: GameSession = {
      ...session,
      totalAnswers,
      correctAnswers,
      averageTimePerWord
    };

    const nextWordProgress = updateWordProgress(
      wordProgressMap,
      currentWord.id,
      evaluation.isCorrect,
      responseTime,
      currentInput.trim(),
      currentWord.german
    );

    saveWordProgressMap(nextWordProgress);

    const feedback: GameFeedback = {
      type: evaluation.isCorrect ? 'correct' : 'wrong',
      title: evaluation.isCorrect ? 'Richtig!' : '回答有误，已显示正确答案',
      correctAnswer: currentWord.german,
      userInput: currentInput,
      note: evaluation.note
    };

    set({
      session: updatedSession,
      answers: [...answers, nextAnswer],
      phase: evaluation.isCorrect ? 'cut_success_anim' : 'show_correct_answer',
      feedback,
      currentInput: '',
      wordProgressMap: nextWordProgress
    });
  },

  skipWord: () => {
    const { session, currentInput, answers, phase } = get();

    if (!session || session.isCompleted || phase !== 'typing') {
      return;
    }

    const currentWord = session.wordsInSession[session.currentWordIndex];
    if (!currentWord) {
      return;
    }

    const nextAnswer: GameAnswer = {
      sessionId: session.id,
      wordId: currentWord.id,
      userInput: currentInput.trim(),
      correctAnswer: currentWord.german,
      isCorrect: false,
      timestamp: new Date().toISOString(),
      feedbackType: 'skip'
    };

    const updatedSession: GameSession = {
      ...session,
      totalAnswers: session.totalAnswers + 1
    };

    set({
      session: updatedSession,
      answers: [...answers, nextAnswer],
      phase: 'show_correct_answer',
      feedback: {
        type: 'skip',
        title: '已跳过本题',
        correctAnswer: currentWord.german,
        userInput: currentInput,
        note: '已自动进入下一题。'
      },
      currentInput: ''
    });
  },

  nextWord: () => {
    const { session, phase } = get();

    if (!session || (phase !== 'cut_success_anim' && phase !== 'show_correct_answer')) {
      return;
    }

    const nextIndex = session.currentWordIndex + 1;
    if (nextIndex >= session.wordsInSession.length) {
      const completedSession: GameSession = {
        ...session,
        currentWordIndex: session.wordsInSession.length - 1,
        isCompleted: true,
        endTime: new Date().toISOString()
      };

      appendSessionHistory(completedSession);

      set({
        session: completedSession,
        phase: 'completed',
        feedback: null,
        currentInput: ''
      });
      return;
    }

    set({
      session: {
        ...session,
        currentWordIndex: nextIndex
      },
      phase: 'typing',
      feedback: null,
      currentInput: '',
      wordStartedAtMs: Date.now()
    });
  },

  updateSettings: (patch) => {
    const settings = {
      ...get().settings,
      ...patch
    };

    saveGameSettings(settings);
    set({ settings });
  },

  importWordsFromJsonText: (raw) => {
    try {
      const parsed = parseJsonWords(raw);
      const { validWords, errors } = validateWords(parsed);

      if (errors.length > 0) {
        set({
          importReport: {
            addedWords: 0,
            errors
          }
        });
        return;
      }

      const result = commitWords(validWords);
      const imported = loadImportedWords();
      const allWords = mergeWords(DEFAULT_WORDS, imported);

      set({
        allWords,
        importReport: result
      });
    } catch {
      set({
        importReport: {
          addedWords: 0,
          errors: [{ index: -1, field: 'json', message: 'JSON 解析失败，请检查文件格式。' }]
        }
      });
    }
  },

  clearImportReport: () => set({ importReport: null })
}));

export const getCurrentWord = (session: GameSession | null): Word | null => {
  if (!session || session.wordsInSession.length === 0) {
    return null;
  }

  return session.wordsInSession[session.currentWordIndex] ?? null;
};

export const getAccuracy = (session: GameSession | null): number => {
  if (!session || session.totalAnswers === 0) {
    return 0;
  }

  return Math.round((session.correctAnswers / session.totalAnswers) * 100);
};

export const difficultyOptions: Array<{ label: string; value: Difficulty | 'mixed' }> = [
  { label: '混合', value: 'mixed' },
  { label: 'A1', value: 'A1' },
  { label: 'A2', value: 'A2' },
  { label: 'B1', value: 'B1' }
];
