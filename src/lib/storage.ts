import type { GameSession, GameSettings, Word, WordProgress } from '../types';

const storageKeys = {
  userProgress: 'sausage_game_progress',
  gameSettings: 'sausage_game_settings',
  wordStats: 'sausage_game_word_stats',
  sessionHistory: 'sausage_game_sessions',
  importedWords: 'sausage_game_imported_words'
} as const;

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable. Keep game playable in memory.
  }
};

export const loadImportedWords = (): Word[] => readJson<Word[]>(storageKeys.importedWords, []);

export const saveImportedWords = (words: Word[]): void => {
  writeJson(storageKeys.importedWords, words);
};

export const loadGameSettings = (defaults: GameSettings): GameSettings =>
  readJson<GameSettings>(storageKeys.gameSettings, defaults);

export const saveGameSettings = (settings: GameSettings): void => {
  writeJson(storageKeys.gameSettings, settings);
};

export const loadWordProgressMap = (): Record<string, WordProgress> =>
  readJson<Record<string, WordProgress>>(storageKeys.wordStats, {});

export const saveWordProgressMap = (progress: Record<string, WordProgress>): void => {
  writeJson(storageKeys.wordStats, progress);
  writeJson(storageKeys.userProgress, progress);
};

export const appendSessionHistory = (session: GameSession): void => {
  const current = readJson<GameSession[]>(storageKeys.sessionHistory, []);
  const next = [session, ...current].slice(0, 100);
  writeJson(storageKeys.sessionHistory, next);
};

export const storageKeyMap = storageKeys;
