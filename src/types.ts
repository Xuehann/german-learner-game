export type Difficulty = 'A1' | 'A2' | 'B1';

export interface Word {
  id: string;
  english: string;
  german: string;
  gender?: 'der' | 'die' | 'das';
  plural?: string;
  category: string;
  difficulty: Difficulty;
  pronunciation?: string;
  example?: {
    german: string;
    english: string;
  };
  sourceType?: 'builtin' | 'imported';
}

export interface WordProgress {
  wordId: string;
  attempts: number;
  correct: number;
  lastReviewDate: string;
  nextReviewDate: string;
  masteryLevel: 0 | 1 | 2 | 3;
  averageResponseTime: number;
  errorPatterns: string[];
}

export interface GameSession {
  id: string;
  startTime: string;
  endTime?: string;
  gameMode: 'sausage_cutting';
  difficulty: Difficulty | 'mixed';
  wordsInSession: Word[];
  currentWordIndex: number;
  correctAnswers: number;
  totalAnswers: number;
  averageTimePerWord: number;
  isCompleted: boolean;
}

export interface GameAnswer {
  sessionId: string;
  wordId: string;
  userInput: string;
  correctAnswer: string;
  isCorrect: boolean;
  responseTime?: number;
  timestamp: string;
  feedbackType: 'correct' | 'wrong' | 'skip';
}

export type GamePhase =
  | 'typing'
  | 'validating'
  | 'cut_success_anim'
  | 'show_correct_answer'
  | 'completed';

export interface GameFeedback {
  type: 'correct' | 'wrong' | 'skip';
  title: string;
  correctAnswer: string;
  userInput: string;
  note?: string;
}

export interface GameSettings {
  sessionSize: number;
  difficulty: Difficulty | 'mixed';
  autoReplace: boolean;
  feedbackDelayMs: number;
}

export interface ImportValidationError {
  index: number;
  field: string;
  message: string;
}

export interface ImportResult {
  addedWords: number;
  errors: ImportValidationError[];
}
