import type {
  BusinessRuntimeSnapshot,
  CoinWallet,
  GameSession,
  GameSettings,
  LearningUnit,
  SausageCollection,
  UnitWord,
  Word,
  WordProgress
} from '../types';

export type UnitWordsMap = Record<string, UnitWord[]>;

const storageKeys = {
  userProgress: 'sausage_game_progress',
  gameSettings: 'sausage_game_settings',
  wordStats: 'sausage_game_word_stats',
  sessionHistory: 'sausage_game_sessions',
  importedWords: 'sausage_game_imported_words',
  learningUnits: 'sausage_learning_units',
  learningUnitWords: 'sausage_learning_unit_words',
  activeUnitId: 'sausage_learning_active_unit_id',
  coinWallet: 'sausage_shop_coin_wallet',
  sausageCollection: 'sausage_shop_collection',
  runtimeSnapshot: 'sausage_shop_runtime_snapshot'
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

const removeKey = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore localStorage errors.
  }
};

export const loadLegacyImportedWords = (): Word[] =>
  readJson<Word[]>(storageKeys.importedWords, []);

export const clearLegacyImportedWords = (): void => {
  removeKey(storageKeys.importedWords);
};

export const loadLearningUnits = (): LearningUnit[] =>
  readJson<LearningUnit[]>(storageKeys.learningUnits, []);

export const saveLearningUnits = (units: LearningUnit[]): void => {
  writeJson(storageKeys.learningUnits, units);
};

export const loadUnitWordsMap = (): UnitWordsMap =>
  readJson<UnitWordsMap>(storageKeys.learningUnitWords, {});

export const saveUnitWordsMap = (map: UnitWordsMap): void => {
  writeJson(storageKeys.learningUnitWords, map);
};

export const loadActiveUnitId = (): string | null =>
  readJson<string | null>(storageKeys.activeUnitId, null);

export const saveActiveUnitId = (unitId: string | null): void => {
  writeJson(storageKeys.activeUnitId, unitId);
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
  const next = [session, ...current].slice(0, 120);
  writeJson(storageKeys.sessionHistory, next);
};

export const loadCoinWallet = (defaults: CoinWallet): CoinWallet =>
  readJson<CoinWallet>(storageKeys.coinWallet, defaults);

export const saveCoinWallet = (wallet: CoinWallet): void => {
  writeJson(storageKeys.coinWallet, wallet);
};

export const loadSausageCollection = (defaults: SausageCollection): SausageCollection =>
  readJson<SausageCollection>(storageKeys.sausageCollection, defaults);

export const saveSausageCollection = (collection: SausageCollection): void => {
  writeJson(storageKeys.sausageCollection, collection);
};

export const loadRuntimeSnapshot = (): BusinessRuntimeSnapshot | null =>
  readJson<BusinessRuntimeSnapshot | null>(storageKeys.runtimeSnapshot, null);

export const saveRuntimeSnapshot = (snapshot: BusinessRuntimeSnapshot): void => {
  writeJson(storageKeys.runtimeSnapshot, snapshot);
};

export const clearRuntimeSnapshot = (): void => {
  removeKey(storageKeys.runtimeSnapshot);
};

export const storageKeyMap = storageKeys;
