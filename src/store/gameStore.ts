import { create } from 'zustand';
import { DEFAULT_WORDS } from '../data/defaultWords';
import { evaluateAnswer } from '../lib/answer';
import { coinRewardForOrder, DEFAULT_DAY_GOAL, isDayGoalCompleted } from '../lib/businessRules';
import { appendSpecialCharacter } from '../lib/germanInput';
import { computeMasteryLevel, computeNextReviewDate } from '../lib/review';
import {
  appendSessionHistory,
  clearLegacyImportedWords,
  clearRuntimeSnapshot,
  loadActiveUnitId,
  loadCoinWallet,
  loadGameSettings,
  loadLearningUnits,
  loadLegacyImportedWords,
  loadRuntimeSnapshot,
  loadSausageCollection,
  loadUnitWordsMap,
  loadWordProgressMap,
  saveActiveUnitId,
  saveCoinWallet,
  saveGameSettings,
  saveLearningUnits,
  saveRuntimeSnapshot,
  saveSausageCollection,
  saveUnitWordsMap,
  saveWordProgressMap,
  storageKeyMap,
  type UnitWordsMap
} from '../lib/storage';
import { parseJsonWords, validateWords } from '../lib/wordImport';
import type {
  AIGeneratedUnitDraft,
  BusinessDay,
  CoinWallet,
  Customer,
  DayGoal,
  DayProgress,
  GameAnswer,
  GameFeedback,
  GamePhase,
  GameSession,
  GameSettings,
  ImportResult,
  LearningUnit,
  Order,
  OrderType,
  SausageCollection,
  SausageSkin,
  SatisfactionState,
  Word,
  WordProgress
} from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const normalizePlanStartDate = (value?: string): string => {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return startOfLocalDay(parsed).toISOString();
    }
  }

  return startOfLocalDay(new Date()).toISOString();
};

const DEFAULT_SETTINGS: GameSettings = {
  feedbackDelayMs: 1200,
  planDays: 7,
  planStartDate: normalizePlanStartDate(),
  lastIntroDate: undefined
};

const normalizeSettings = (raw: GameSettings): GameSettings => {
  const merged: GameSettings = {
    ...DEFAULT_SETTINGS,
    ...raw
  };

  return {
    ...merged,
    feedbackDelayMs: Math.max(300, Math.round(merged.feedbackDelayMs)),
    planDays: Math.max(1, Math.round(merged.planDays)),
    planStartDate: normalizePlanStartDate(merged.planStartDate)
  };
};

const DEFAULT_SATISFACTION: SatisfactionState = {
  current: 84,
  min: 20,
  max: 100
};

const DEFAULT_WALLET: CoinWallet = {
  balance: 0,
  earnedToday: 0,
  spentToday: 0
};

export const SAUSAGE_CATALOG: SausageSkin[] = [
  {
    id: 'classic-link',
    name: '经典原味肠',
    rarity: 'common',
    price: 24,
    emoji: '🌭',
    description: '老店招牌，平稳可靠。'
  },
  {
    id: 'pepper-twist',
    name: '黑椒卷肠',
    rarity: 'common',
    price: 32,
    emoji: '🌭',
    description: '顾客最常点的街头款。'
  },
  {
    id: 'smoked-brick',
    name: '熏制方砖肠',
    rarity: 'rare',
    price: 55,
    emoji: '🥓',
    description: '带方块纹理的收藏款。'
  },
  {
    id: 'amber-cube',
    name: '琥珀方块肠',
    rarity: 'rare',
    price: 68,
    emoji: '🧱',
    description: '体素风陈列柜的焦点。'
  },
  {
    id: 'emerald-sausage',
    name: '祖母绿典藏肠',
    rarity: 'epic',
    price: 120,
    emoji: '💎',
    description: '极低掉率，店铺荣耀象征。'
  },
  {
    id: 'royal-banner',
    name: '王冠旗帜肠',
    rarity: 'epic',
    price: 140,
    emoji: '👑',
    description: '顶级收藏，专属展示。'
  }
];

const DEFAULT_COLLECTION: SausageCollection = {
  ownedSkinIds: ['classic-link'],
  displaySkinId: 'classic-link'
};

const CUSTOMER_NAMES = ['Bär', 'Hund', 'Fuchs', 'Igel', 'Eule'];
const CUSTOMER_AVATARS = ['🧑‍🍳', '👨‍🔧', '👩‍💼', '🧔', '👩‍🦰'];
const FEEDBACK_SPEECHES: Record<GameFeedback['type'], string[]> = {
  correct: ['Gut gemacht!', 'Perfekt!', 'Sehr gut!', 'Ausgezeichnet!'],
  wrong: ['Das war nicht richtig.', 'Versuch es noch einmal.', 'Fast, aber nicht ganz.', 'Schade, noch mal bitte.'],
  skip: ['Ich warte dann auf die nächste Bestellung.', 'Alles klar, wir probieren die nächste Runde.', "Kein Problem, weiter geht's."]
};

const QUEUE_SIZE = 5;
const DAY_CLEAR_BONUS_COINS = 28;

const normalizeInput = (input: string): string => input.trim().replace(/\s+/g, ' ');

const buildDayId = () => `day_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const buildOrderId = () => `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const buildCustomerId = () => `cust_${Math.random().toString(36).slice(2, 8)}`;
const buildUnitId = () => `unit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const pickOne = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)] as T;
const pickFeedbackSpeech = (type: GameFeedback['type']): string => pickOne(FEEDBACK_SPEECHES[type]);

const remainingCorrectAnswersToMastery = (progress: Pick<WordProgress, 'attempts' | 'correct'>): number => {
  const needAttempts = Math.max(0, 2 - progress.attempts);
  const needAccuracy = Math.max(0, 4 * progress.attempts - 5 * progress.correct);
  return Math.max(needAttempts, needAccuracy);
};

const buildMasteryHint = (
  lineMastery: Array<{ german: string; next: WordProgress; becameMastered: boolean }>,
  orderType: OrderType,
  isCorrect: boolean
): string | undefined => {
  if (lineMastery.length === 0) {
    return undefined;
  }

  const parts = lineMastery.map((item) => {
    if (item.becameMastered) {
      return `${item.german} 在本题达到 masteryLevel 3。`;
    }

    const remaining = remainingCorrectAnswersToMastery(item.next);
    if (remaining <= 0) {
      return `${item.german} 当前已是掌握词（masteryLevel 3）。`;
    }

    return `${item.german} 还差 ${remaining} 次正确作答可达 masteryLevel 3（当前 ${item.next.correct}/${item.next.attempts}）。`;
  });

  if (orderType !== 'combo') {
    const first = lineMastery[0];
    if (!first) {
      return undefined;
    }

    if (isCorrect && !first.becameMastered) {
      const remaining = remainingCorrectAnswersToMastery(first.next);
      if (remaining > 0) {
        return `本题答对，但未达掌握阈值。${parts[0] ?? ''}`;
      }
    }

    return parts[0];
  }

  return parts.join('；');
};

const mergeWords = (builtins: Word[], activeUnitWords: Word[]): Word[] => {
  return [...builtins, ...activeUnitWords];
};

const getActiveUnitWords = (unitWordsMap: UnitWordsMap, unitId: string | null): Word[] => {
  if (!unitId) {
    return [];
  }

  return unitWordsMap[unitId] ?? [];
};

const normalizeUnitName = (name: string | undefined, fallback: string): string => {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : fallback;
};

const buildImportedWordForUnit = (unitId: string, word: Word, index: number): Word => {
  const baseId = word.id.trim() || `word_${index + 1}`;
  const safeBaseId = baseId.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_:\-]/g, '');

  return {
    id: `${unitId}::${safeBaseId || `word_${index + 1}`}`,
    english: word.english.trim(),
    german: word.german.trim(),
    category: word.category.trim(),
    ...(word.pastTense ? { pastTense: word.pastTense.trim() } : {}),
    ...(word.gender ? { gender: word.gender } : {}),
    ...(word.plural ? { plural: word.plural } : {}),
    ...(word.pronunciation ? { pronunciation: word.pronunciation } : {}),
    ...(word.example ? { example: word.example } : {}),
    sourceType: 'imported'
  };
};

const buildUnitMessage = (name: string, count: number): string =>
  `学习单元“${name}”已创建并导入 ${count} 个单词。`;

export const resolveLearningPool = (allWords: Word[]): Word[] => {
  const imported = allWords.filter((word) => word.sourceType === 'imported');
  if (imported.length > 0) {
    return imported;
  }

  return allWords.filter((word) => word.sourceType !== 'imported');
};

const parsePlanStartDate = (planStartDate: string): Date => {
  const parsed = new Date(planStartDate);
  if (Number.isNaN(parsed.getTime())) {
    return startOfLocalDay(new Date());
  }

  return startOfLocalDay(parsed);
};

export const getPlanProgress = (
  planStartDate: string,
  planDays: number,
  now: Date = new Date()
): { dayIndex: number; daysLeft: number } => {
  const normalizedDays = Math.max(1, Math.round(planDays));
  const start = parsePlanStartDate(planStartDate);
  const today = startOfLocalDay(now);

  if (today.getTime() < start.getTime()) {
    return {
      dayIndex: 1,
      daysLeft: normalizedDays
    };
  }

  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / DAY_MS);
  return {
    dayIndex: Math.min(normalizedDays, elapsedDays + 1),
    daysLeft: Math.max(1, normalizedDays - elapsedDays)
  };
};

export const countRemainingUnmastered = (
  pool: Word[],
  progressMap: Record<string, WordProgress>
): number => {
  return pool.filter((word) => (progressMap[word.id]?.masteryLevel ?? 0) < 3).length;
};

export const buildDynamicDayGoal = (
  remainingUnmastered: number,
  pendingCorrectionCount: number,
  remainingDays: number
): DayGoal => {
  const days = Math.max(1, remainingDays);

  return {
    newMasteredTarget:
      remainingUnmastered <= 0 ? 0 : Math.ceil(remainingUnmastered / days),
    correctedMistakesTarget:
      pendingCorrectionCount <= 0 ? 0 : Math.ceil(pendingCorrectionCount / days)
  };
};

const isDueForReview = (progress?: WordProgress): boolean => {
  if (!progress) {
    return true;
  }
  return new Date(progress.nextReviewDate).getTime() <= Date.now();
};

const scoreWord = (
  word: Word,
  progressMap: Record<string, WordProgress>,
  pendingCorrectionWordIds: string[]
): number => {
  const progress = progressMap[word.id];
  const masteryPenalty = 3 - (progress?.masteryLevel ?? 0);
  const dueBonus = isDueForReview(progress) ? 1.3 : 0.2;
  const correctionBonus = pendingCorrectionWordIds.includes(word.id) ? 3.5 : 0;
  return 1 + masteryPenalty + dueBonus + correctionBonus;
};

const weightedPickWord = (
  words: Word[],
  progressMap: Record<string, WordProgress>,
  pendingCorrectionWordIds: string[]
): Word => {
  const scored = words.map((word) => ({
    word,
    score: scoreWord(word, progressMap, pendingCorrectionWordIds)
  }));

  const total = scored.reduce((sum, item) => sum + item.score, 0);
  let cursor = Math.random() * total;

  for (const item of scored) {
    cursor -= item.score;
    if (cursor <= 0) {
      return item.word;
    }
  }

  return scored[scored.length - 1]?.word ?? (words[0] as Word);
};

const buildCustomer = (): Customer => {
  const name = pickOne(CUSTOMER_NAMES);
  const avatar = pickOne(CUSTOMER_AVATARS);

  const roll = Math.random();
  const tier = roll > 0.82 ? 'collector' : roll > 0.55 ? 'rush' : 'regular';

  return {
    id: buildCustomerId(),
    name,
    avatar,
    tier
  };
};

const chooseOrderType = (hasPendingCorrections: boolean): OrderType => {
  if (hasPendingCorrections && Math.random() < 0.48) {
    return 'review';
  }

  const bucket: OrderType[] = ['translation', 'translation', 'combo', 'translation'];
  return pickOne(bucket);
};

const buildTranslationOrder = (word: Word, type: OrderType): Omit<Order, 'id' | 'customer'> => ({
  type,
  lines: [
    {
      wordId: word.id,
      english: word.english,
      german: word.german,
      category: word.category,
      pastTense: word.pastTense
    }
  ],
  prompt: `顾客点单：${word.english}`,
  instruction: '请输入完整德语拼写（含冠词时请一起输入）。'
});

const buildComboOrder = (first: Word, second: Word): Omit<Order, 'id' | 'customer'> => ({
  type: 'combo',
  lines: [
    {
      wordId: first.id,
      english: first.english,
      german: first.german,
      category: first.category,
      pastTense: first.pastTense
    },
    {
      wordId: second.id,
      english: second.english,
      german: second.german,
      category: second.category,
      pastTense: second.pastTense
    }
  ],
  prompt: `顾客点两份：${first.english} + ${second.english}`,
  instruction: '请用逗号分隔输入两个德语答案。'
});

const buildCorrectAnswerText = (order: Order): string => {
  if (order.type === 'combo') {
    return order.lines.map((line) => line.german).join(', ');
  }

  return order.lines[0]?.german ?? '';
};

const evaluateOrder = (order: Order, rawInput: string): { isCorrect: boolean; note?: string } => {
  const input = normalizeInput(rawInput);

  if (!input) {
    return { isCorrect: false, note: '未输入答案。' };
  }

  if (order.type === 'combo') {
    const pieces = input
      .split(/[，,;；]/)
      .map((piece) => normalizeInput(piece))
      .filter(Boolean);

    if (pieces.length < 2) {
      return { isCorrect: false, note: '该订单需要两个答案，并用逗号分隔。' };
    }

    const first = order.lines[0];
    const second = order.lines[1];

    const firstResult = evaluateAnswer(pieces[0] ?? '', first?.german ?? '');
    const secondResult = evaluateAnswer(pieces[1] ?? '', second?.german ?? '');

    return {
      isCorrect: firstResult.isCorrect && secondResult.isCorrect,
      note: firstResult.note ?? secondResult.note
    };
  }

  const single = order.lines[0];
  return evaluateAnswer(input, single?.german ?? '');
};

const isVerbCategory = (category: string): boolean => {
  const lower = category.toLowerCase();
  return lower.includes('verb') || category.includes('动词');
};

const buildVerbPastTenseNote = (order: Order): string | undefined => {
  const verbLines = order.lines.filter((line) => isVerbCategory(line.category));
  if (verbLines.length === 0) {
    return undefined;
  }

  const parts = verbLines.map((line) => `${line.german} -> ${line.pastTense ?? '（未提供）'}`);
  return `动词过去式: ${parts.join('；')}`;
};

const updateWordProgressEntry = (
  previous: WordProgress | undefined,
  wordId: string,
  isCorrect: boolean,
  responseTime: number,
  userInput: string,
  correctAnswer: string
): { next: WordProgress; becameMastered: boolean } => {
  const now = new Date();
  const attempts = (previous?.attempts ?? 0) + 1;
  const correct = (previous?.correct ?? 0) + (isCorrect ? 1 : 0);
  const averageResponseTime =
    ((previous?.averageResponseTime ?? 0) * (attempts - 1) + responseTime) / attempts;
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
      ? previous?.errorPatterns ?? []
      : [...(previous?.errorPatterns ?? []), `${userInput} => ${correctAnswer}`].slice(-12)
  };

  return {
    next,
    becameMastered: (previous?.masteryLevel ?? 0) < 3 && masteryLevel === 3
  };
};

const hasLegacyArticleOrder = (runtime: {
  orderQueue: Array<{ type?: string }>;
  currentOrder: { type?: string } | null;
}): boolean => {
  if (runtime.currentOrder?.type === 'article') {
    return true;
  }

  return runtime.orderQueue.some((order) => order.type === 'article');
};

const buildOrder = (
  allWords: Word[],
  progressMap: Record<string, WordProgress>,
  pendingCorrectionWordIds: string[]
): Order => {
  const customer = buildCustomer();
  const pool = resolveLearningPool(allWords);
  const orderType = chooseOrderType(pendingCorrectionWordIds.length > 0);

  if (orderType === 'review' && pendingCorrectionWordIds.length > 0) {
    const pendingWords = pool.filter((word) => pendingCorrectionWordIds.includes(word.id));
    const picked = weightedPickWord(
      pendingWords.length > 0 ? pendingWords : pool,
      progressMap,
      pendingCorrectionWordIds
    );
    const base = buildTranslationOrder(picked, 'review');

    return {
      id: buildOrderId(),
      customer,
      ...base
    };
  }

  if (orderType === 'combo' && pool.length > 1) {
    const first = weightedPickWord(pool, progressMap, pendingCorrectionWordIds);
    const rest = pool.filter((word) => word.id !== first.id);
    const second = weightedPickWord(rest.length > 0 ? rest : pool, progressMap, pendingCorrectionWordIds);

    return {
      id: buildOrderId(),
      customer,
      ...buildComboOrder(first, second)
    };
  }

  const picked = weightedPickWord(pool, progressMap, pendingCorrectionWordIds);
  return {
    id: buildOrderId(),
    customer,
    ...buildTranslationOrder(picked, 'translation')
  };
};

const buildOrderAvoidingSameCustomer = (
  allWords: Word[],
  progressMap: Record<string, WordProgress>,
  pendingCorrectionWordIds: string[],
  previousCustomerName?: string
): Order => {
  const maxRetry = 12;
  let attempt = 0;
  let order = buildOrder(allWords, progressMap, pendingCorrectionWordIds);

  while (previousCustomerName && order.customer.name === previousCustomerName && attempt < maxRetry) {
    order = buildOrder(allWords, progressMap, pendingCorrectionWordIds);
    attempt += 1;
  }

  return order;
};

const fillQueueToSize = (
  baseQueue: Order[],
  allWords: Word[],
  progressMap: Record<string, WordProgress>,
  pendingCorrectionWordIds: string[],
  size = QUEUE_SIZE
): Order[] => {
  const nextQueue = [...baseQueue];

  while (nextQueue.length < size) {
    const prevName = nextQueue[nextQueue.length - 1]?.customer.name;
    nextQueue.push(buildOrderAvoidingSameCustomer(allWords, progressMap, pendingCorrectionWordIds, prevName));
  }

  return nextQueue.slice(0, size);
};

const normalizeQueueNoAdjacentSameCustomer = (
  queue: Order[],
  allWords: Word[],
  progressMap: Record<string, WordProgress>,
  pendingCorrectionWordIds: string[]
): Order[] => {
  const normalized: Order[] = [];

  queue.forEach((order) => {
    const prevName = normalized[normalized.length - 1]?.customer.name;
    if (prevName && order.customer.name === prevName) {
      normalized.push(buildOrderAvoidingSameCustomer(allWords, progressMap, pendingCorrectionWordIds, prevName));
      return;
    }
    normalized.push(order);
  });

  return normalized;
};

type AIState = 'idle' | 'loading' | 'error' | 'ready';

interface GameState {
  isInitialized: boolean;
  allWords: Word[];
  learningUnits: LearningUnit[];
  unitWordsMap: UnitWordsMap;
  activeUnitId: string | null;
  phase: GamePhase;
  phaseBeforeShop: GamePhase | null;
  currentOrder: Order | null;
  orderQueue: Order[];
  businessDay: BusinessDay | null;
  feedback: GameFeedback | null;
  currentInput: string;
  orderStartedAtMs: number;
  answers: GameAnswer[];
  satisfaction: SatisfactionState;
  coins: CoinWallet;
  collection: SausageCollection;
  wordProgressMap: Record<string, WordProgress>;
  importReport: ImportResult | null;
  settings: GameSettings;
  aiDraft: AIGeneratedUnitDraft | null;
  aiState: AIState;
  aiError: string | null;
  initializeGame: () => void;
  startBusinessDay: () => void;
  generateOrder: () => void;
  advanceIntro: () => void;
  skipIntro: () => void;
  openShop: () => void;
  closeShop: () => void;
  applyPlanAdjustmentAndStartNextDay: (remainingDays: number) => void;
  updatePlanDaysForCurrentDay: (days: number) => void;
  setInput: (value: string) => void;
  appendSpecialChar: (char: string) => void;
  submitOrderAnswer: () => void;
  skipOrder: () => void;
  continueAfterFeedback: () => void;
  updateSatisfaction: (delta: number) => void;
  settleCoins: (orderType: OrderType, isCorrect: boolean) => number;
  completeDayIfGoalMet: () => boolean;
  redeemSausage: (skinId: string) => void;
  setDisplaySausage: (skinId: string) => void;
  resetAllLocalData: () => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  importWordsFromJsonText: (raw: string, unitName?: string) => void;
  generateWordsFromText: (rawText: string, unitName?: string) => Promise<void>;
  saveGeneratedDraft: (unitName?: string) => void;
  clearGeneratedDraft: () => void;
  clearImportReport: () => void;
  setActiveLearningUnit: (unitId: string | null) => void;
  renameLearningUnit: (unitId: string, nextName: string) => void;
  deleteLearningUnit: (unitId: string) => void;
}

const hydrateBusinessDay = (
  day: BusinessDay,
  settings: GameSettings,
  allWords: Word[]
): BusinessDay => {
  const plan = getPlanProgress(settings.planStartDate, settings.planDays);
  const poolSize = resolveLearningPool(allWords).length;

  return {
    ...day,
    planDayIndex:
      Number.isFinite(day.planDayIndex) && day.planDayIndex > 0 ? day.planDayIndex : plan.dayIndex,
    planDaysLeft:
      Number.isFinite(day.planDaysLeft) && day.planDaysLeft > 0 ? day.planDaysLeft : plan.daysLeft,
    planPoolSize:
      Number.isFinite(day.planPoolSize) && day.planPoolSize > 0 ? day.planPoolSize : poolSize,
    goalComputedAt:
      typeof day.goalComputedAt === 'string' && day.goalComputedAt.length > 0
        ? day.goalComputedAt
        : new Date().toISOString()
  };
};

const persistRuntimeFromState = (state: {
  businessDay: BusinessDay | null;
  orderQueue: Order[];
  currentOrder: Order | null;
  satisfaction: SatisfactionState;
  phase: GamePhase;
  phaseBeforeShop: GamePhase | null;
}) => {
  if (!state.businessDay || state.businessDay.isCompleted) {
    clearRuntimeSnapshot();
    return;
  }

  saveRuntimeSnapshot({
    businessDay: state.businessDay,
    orderQueue: state.orderQueue,
    currentOrder: state.currentOrder,
    satisfaction: state.satisfaction,
    phase: state.phase,
    phaseBeforeShop: state.phaseBeforeShop
  });
};

const rebuildAllWords = (unitWordsMap: UnitWordsMap, activeUnitId: string | null): Word[] => {
  return mergeWords(DEFAULT_WORDS, getActiveUnitWords(unitWordsMap, activeUnitId));
};

const rebuildRunningDayForNewPool = (params: {
  businessDay: BusinessDay | null;
  allWords: Word[];
  settings: GameSettings;
  wordProgressMap: Record<string, WordProgress>;
}): { businessDay: BusinessDay; orderQueue: Order[]; currentOrder: Order | null } | null => {
  const { businessDay, allWords, settings, wordProgressMap } = params;
  if (!businessDay || businessDay.isCompleted) {
    return null;
  }

  const pool = resolveLearningPool(allWords);
  const pendingCorrectionWordIds = Array.from(new Set(businessDay.pendingCorrectionWordIds)).filter((wordId) =>
    pool.some((word) => word.id === wordId)
  );
  const planProgress = getPlanProgress(settings.planStartDate, settings.planDays);
  const remainingUnmastered = countRemainingUnmastered(pool, wordProgressMap);

  const nextBusinessDay: BusinessDay = {
    ...businessDay,
    goal: buildDynamicDayGoal(remainingUnmastered, pendingCorrectionWordIds.length, planProgress.daysLeft),
    pendingCorrectionWordIds,
    planDayIndex: planProgress.dayIndex,
    planDaysLeft: planProgress.daysLeft,
    planPoolSize: pool.length,
    goalComputedAt: new Date().toISOString()
  };

  const nextQueue = fillQueueToSize([], allWords, wordProgressMap, nextBusinessDay.pendingCorrectionWordIds);

  return {
    businessDay: nextBusinessDay,
    orderQueue: nextQueue,
    currentOrder: nextQueue[0] ?? null
  };
};

const migrateLegacyImportedWordsToUnit = (
  units: LearningUnit[],
  unitWordsMap: UnitWordsMap,
  activeUnitId: string | null
): { units: LearningUnit[]; unitWordsMap: UnitWordsMap; activeUnitId: string | null } => {
  if (units.length > 0) {
    return { units, unitWordsMap, activeUnitId };
  }

  const legacyWords = loadLegacyImportedWords();
  if (legacyWords.length === 0) {
    return { units, unitWordsMap, activeUnitId };
  }

  const now = new Date().toISOString();
  const legacyUnitId = 'unit_legacy';
  const normalizedWords = legacyWords.map((word, index) => buildImportedWordForUnit(legacyUnitId, word, index));
  const legacyUnit: LearningUnit = {
    id: legacyUnitId,
    name: '历史导入单元',
    createdAt: now,
    updatedAt: now,
    wordCount: normalizedWords.length
  };

  const nextUnits = [legacyUnit];
  const nextMap: UnitWordsMap = {
    ...unitWordsMap,
    [legacyUnitId]: normalizedWords
  };

  saveLearningUnits(nextUnits);
  saveUnitWordsMap(nextMap);
  saveActiveUnitId(legacyUnitId);
  clearLegacyImportedWords();

  return {
    units: nextUnits,
    unitWordsMap: nextMap,
    activeUnitId: legacyUnitId
  };
};

const buildUnitFromWords = (
  words: Word[],
  unitName: string | undefined,
  existingUnits: LearningUnit[]
): { unit: LearningUnit; unitWords: Word[] } => {
  const unitId = buildUnitId();
  const now = new Date().toISOString();
  const fallbackName = `学习单元 ${existingUnits.length + 1}`;
  const finalName = normalizeUnitName(unitName, fallbackName);

  const unitWords = words.map((word, index) => buildImportedWordForUnit(unitId, word, index));

  const unit: LearningUnit = {
    id: unitId,
    name: finalName,
    createdAt: now,
    updatedAt: now,
    wordCount: unitWords.length
  };

  return { unit, unitWords };
};

export const useGameStore = create<GameState>((set, get) => ({
  isInitialized: false,
  allWords: DEFAULT_WORDS,
  learningUnits: [],
  unitWordsMap: {},
  activeUnitId: null,
  phase: 'serving_order',
  phaseBeforeShop: null,
  currentOrder: null,
  orderQueue: [],
  businessDay: null,
  feedback: null,
  currentInput: '',
  orderStartedAtMs: Date.now(),
  answers: [],
  satisfaction: DEFAULT_SATISFACTION,
  coins: DEFAULT_WALLET,
  collection: DEFAULT_COLLECTION,
  wordProgressMap: {},
  importReport: null,
  settings: DEFAULT_SETTINGS,
  aiDraft: null,
  aiState: 'idle',
  aiError: null,

  initializeGame: () => {
    const rawSettings = loadGameSettings(DEFAULT_SETTINGS);
    const settings = normalizeSettings(rawSettings);
    const wordProgressMap = loadWordProgressMap();
    const coins = loadCoinWallet(DEFAULT_WALLET);
    const collection = loadSausageCollection(DEFAULT_COLLECTION);

    const loadedUnits = loadLearningUnits();
    const loadedMap = loadUnitWordsMap();
    const loadedActiveId = loadActiveUnitId();

    const migrated = migrateLegacyImportedWordsToUnit(loadedUnits, loadedMap, loadedActiveId);
    const units = migrated.units;
    const unitWordsMap = migrated.unitWordsMap;

    const activeUnitId = units.some((unit) => unit.id === migrated.activeUnitId)
      ? migrated.activeUnitId
      : units[0]?.id ?? null;

    if (activeUnitId !== migrated.activeUnitId) {
      saveActiveUnitId(activeUnitId);
    }

    const allWords = rebuildAllWords(unitWordsMap, activeUnitId);

    const runtime = loadRuntimeSnapshot();
    const nextSettings = settings;

    if (runtime && !runtime.businessDay.isCompleted && !hasLegacyArticleOrder(runtime)) {
      const hydratedDay = hydrateBusinessDay(runtime.businessDay, nextSettings, allWords);
      const restoredCurrent = runtime.currentOrder;
      const dedupedBaseQueue =
        restoredCurrent === null
          ? [...runtime.orderQueue]
          : [restoredCurrent, ...runtime.orderQueue.filter((order) => order.id !== restoredCurrent.id)];

      const normalizedQueue = normalizeQueueNoAdjacentSameCustomer(
        dedupedBaseQueue,
        allWords,
        wordProgressMap,
        hydratedDay.pendingCorrectionWordIds
      );
      const restoredQueue = fillQueueToSize(
        normalizedQueue,
        allWords,
        wordProgressMap,
        hydratedDay.pendingCorrectionWordIds
      );
      const nextCurrent = restoredQueue[0] ?? null;

      set({
        isInitialized: true,
        allWords,
        learningUnits: units,
        unitWordsMap,
        activeUnitId,
        settings: nextSettings,
        wordProgressMap,
        coins: {
          ...coins,
          earnedToday: 0,
          spentToday: 0
        },
        collection,
        businessDay: hydratedDay,
        orderQueue: restoredQueue,
        currentOrder: nextCurrent,
        satisfaction: runtime.satisfaction,
        phase: 'intro_door',
        phaseBeforeShop: null,
        orderStartedAtMs: Date.now()
      });

      saveGameSettings(nextSettings);
      persistRuntimeFromState({
        businessDay: hydratedDay,
        currentOrder: nextCurrent,
        orderQueue: restoredQueue,
        satisfaction: runtime.satisfaction,
        phase: 'intro_door',
        phaseBeforeShop: null
      });
      return;
    }

    if (runtime && hasLegacyArticleOrder(runtime)) {
      clearRuntimeSnapshot();
    }

    set({
      isInitialized: true,
      allWords,
      learningUnits: units,
      unitWordsMap,
      activeUnitId,
      settings: nextSettings,
      wordProgressMap,
      coins,
      collection
    });

    saveGameSettings(nextSettings);
    get().startBusinessDay();
  },

  startBusinessDay: () => {
    const { allWords, settings, wordProgressMap, coins, businessDay: previousDay } = get();
    const pool = resolveLearningPool(allWords);
    const planProgress = getPlanProgress(settings.planStartDate, settings.planDays);
    const remainingUnmastered = countRemainingUnmastered(pool, wordProgressMap);
    const carryPending = Array.from(new Set(previousDay?.pendingCorrectionWordIds ?? [])).filter((wordId) =>
      pool.some((word) => word.id === wordId)
    );
    const goal = buildDynamicDayGoal(remainingUnmastered, carryPending.length, planProgress.daysLeft);

    const businessDay: BusinessDay = {
      id: buildDayId(),
      startedAt: new Date().toISOString(),
      goal,
      progress: {
        newMastered: 0,
        correctedMistakes: 0,
        servedOrders: 0,
        correctOrders: 0
      },
      pendingCorrectionWordIds: carryPending,
      planDayIndex: planProgress.dayIndex,
      planDaysLeft: planProgress.daysLeft,
      planPoolSize: pool.length,
      goalComputedAt: new Date().toISOString(),
      isCompleted: false
    };

    const queue = fillQueueToSize([], allWords, wordProgressMap, businessDay.pendingCorrectionWordIds);

    const nextCoins: CoinWallet = {
      ...coins,
      earnedToday: 0,
      spentToday: 0
    };

    const nextPhase: GamePhase = 'intro_door';

    set({
      businessDay,
      phase: nextPhase,
      phaseBeforeShop: null,
      currentOrder: queue[0] ?? null,
      orderQueue: queue,
      feedback: null,
      currentInput: '',
      orderStartedAtMs: Date.now(),
      answers: [],
      satisfaction: DEFAULT_SATISFACTION,
      coins: nextCoins,
      settings
    });

    saveCoinWallet(nextCoins);
    saveGameSettings(settings);

    persistRuntimeFromState({
      businessDay,
      currentOrder: queue[0] ?? null,
      orderQueue: queue,
      satisfaction: DEFAULT_SATISFACTION,
      phase: nextPhase,
      phaseBeforeShop: null
    });
  },

  generateOrder: () => {
    const { allWords, wordProgressMap, businessDay, orderQueue, phase, phaseBeforeShop } = get();
    if (!businessDay || businessDay.isCompleted) {
      return;
    }

    const prevName = orderQueue[orderQueue.length - 1]?.customer.name;
    const nextOrder = buildOrderAvoidingSameCustomer(
      allWords,
      wordProgressMap,
      businessDay.pendingCorrectionWordIds,
      prevName
    );

    const nextQueue = [...orderQueue, nextOrder];
    set({ orderQueue: nextQueue });

    persistRuntimeFromState({
      businessDay,
      currentOrder: get().currentOrder,
      orderQueue: nextQueue,
      satisfaction: get().satisfaction,
      phase,
      phaseBeforeShop
    });
  },

  advanceIntro: () => {
    const { phase, businessDay, orderQueue, currentOrder, satisfaction, phaseBeforeShop } = get();
    if (!businessDay) {
      return;
    }

    const nextPhase: GamePhase = phase === 'intro_door' ? 'intro_goal' : 'serving_order';

    set({ phase: nextPhase });

    persistRuntimeFromState({
      businessDay,
      currentOrder,
      orderQueue,
      satisfaction,
      phase: nextPhase,
      phaseBeforeShop
    });
  },

  skipIntro: () => {
    const { phase } = get();
    if (phase === 'intro_door' || phase === 'intro_goal') {
      get().advanceIntro();
    }
  },

  openShop: () => {
    const { phase, businessDay, orderQueue, currentOrder, satisfaction } = get();
    if (!businessDay || businessDay.isCompleted || phase === 'shop') {
      return;
    }

    if (phase === 'day_summary' || phase === 'intro_door') {
      return;
    }

    set({
      phase: 'shop',
      phaseBeforeShop: phase
    });

    persistRuntimeFromState({
      businessDay,
      currentOrder,
      orderQueue,
      satisfaction,
      phase: 'shop',
      phaseBeforeShop: phase
    });
  },

  closeShop: () => {
    const { phaseBeforeShop, businessDay, orderQueue, currentOrder, satisfaction } = get();
    if (!businessDay || businessDay.isCompleted) {
      return;
    }

    const nextPhase = phaseBeforeShop ?? 'serving_order';
    set({
      phase: nextPhase,
      phaseBeforeShop: null
    });

    persistRuntimeFromState({
      businessDay,
      currentOrder,
      orderQueue,
      satisfaction,
      phase: nextPhase,
      phaseBeforeShop: null
    });
  },

  applyPlanAdjustmentAndStartNextDay: (remainingDays) => {
    const normalizedDays = Math.max(1, Math.round(remainingDays));
    const tomorrow = startOfLocalDay(new Date());
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextSettings = normalizeSettings({
      ...get().settings,
      planDays: normalizedDays,
      planStartDate: tomorrow.toISOString()
    });

    saveGameSettings(nextSettings);
    set({ settings: nextSettings });
    get().startBusinessDay();
  },

  updatePlanDaysForCurrentDay: (days) => {
    const normalizedDays = Math.max(1, Math.min(30, Math.round(days)));
    const state = get();

    const nextSettings = normalizeSettings({
      ...state.settings,
      planDays: normalizedDays
    });

    let nextBusinessDay = state.businessDay;
    if (state.businessDay && !state.businessDay.isCompleted) {
      const pool = resolveLearningPool(state.allWords);
      const pendingCorrectionWordIds = Array.from(new Set(state.businessDay.pendingCorrectionWordIds)).filter(
        (wordId) => pool.some((word) => word.id === wordId)
      );
      const planProgress = getPlanProgress(nextSettings.planStartDate, nextSettings.planDays);
      const remainingUnmastered = countRemainingUnmastered(pool, state.wordProgressMap);

      nextBusinessDay = {
        ...state.businessDay,
        goal: buildDynamicDayGoal(remainingUnmastered, pendingCorrectionWordIds.length, planProgress.daysLeft),
        pendingCorrectionWordIds,
        planDayIndex: planProgress.dayIndex,
        planDaysLeft: planProgress.daysLeft,
        planPoolSize: pool.length,
        goalComputedAt: new Date().toISOString()
      };
    }

    saveGameSettings(nextSettings);
    set({
      settings: nextSettings,
      businessDay: nextBusinessDay
    });

    if (nextBusinessDay && !nextBusinessDay.isCompleted) {
      persistRuntimeFromState({
        businessDay: nextBusinessDay,
        currentOrder: state.currentOrder,
        orderQueue: state.orderQueue,
        satisfaction: state.satisfaction,
        phase: state.phase,
        phaseBeforeShop: state.phaseBeforeShop
      });
    }
  },

  setInput: (value) => set({ currentInput: value }),

  appendSpecialChar: (char) => {
    const current = get().currentInput;
    set({ currentInput: appendSpecialCharacter(current, char) });
  },

  updateSatisfaction: (delta) => {
    const { satisfaction, businessDay, orderQueue, currentOrder, phase, phaseBeforeShop } = get();
    const nextSatisfaction: SatisfactionState = {
      ...satisfaction,
      current: clamp(satisfaction.current + delta, satisfaction.min, satisfaction.max)
    };

    set({ satisfaction: nextSatisfaction });

    persistRuntimeFromState({
      businessDay,
      currentOrder,
      orderQueue,
      satisfaction: nextSatisfaction,
      phase,
      phaseBeforeShop
    });
  },

  settleCoins: (orderType, isCorrect) => {
    const { coins, satisfaction } = get();
    const gain = coinRewardForOrder(orderType, satisfaction, isCorrect);

    if (gain <= 0) {
      return 0;
    }

    const nextCoins: CoinWallet = {
      ...coins,
      balance: coins.balance + gain,
      earnedToday: coins.earnedToday + gain
    };

    set({ coins: nextCoins });
    saveCoinWallet(nextCoins);
    return gain;
  },

  completeDayIfGoalMet: () => {
    const { businessDay, coins } = get();
    if (!businessDay || businessDay.isCompleted) {
      return false;
    }

    if (!isDayGoalCompleted(businessDay.progress, businessDay.goal)) {
      return false;
    }

    const completedDay: BusinessDay = {
      ...businessDay,
      isCompleted: true,
      completedAt: new Date().toISOString()
    };

    const bonusCoins = DAY_CLEAR_BONUS_COINS;
    const nextCoins: CoinWallet = {
      ...coins,
      balance: coins.balance + bonusCoins,
      earnedToday: coins.earnedToday + bonusCoins
    };

    const accuracy =
      completedDay.progress.servedOrders === 0
        ? 0
        : Math.round((completedDay.progress.correctOrders / completedDay.progress.servedOrders) * 100);

    const session: GameSession = {
      id: completedDay.id,
      startTime: completedDay.startedAt,
      endTime: completedDay.completedAt,
      gameMode: 'butcher_business',
      dayGoal: completedDay.goal,
      dayProgress: completedDay.progress,
      accuracy,
      coinsEarned: nextCoins.earnedToday,
      isCompleted: true
    };

    appendSessionHistory(session);
    saveCoinWallet(nextCoins);
    clearRuntimeSnapshot();

    set({
      businessDay: completedDay,
      phase: 'day_summary',
      phaseBeforeShop: null,
      feedback: null,
      currentInput: '',
      coins: nextCoins
    });

    return true;
  },

  submitOrderAnswer: () => {
    const {
      businessDay,
      currentOrder,
      currentInput,
      wordProgressMap,
      orderStartedAtMs,
      coins,
      answers,
      orderQueue,
      satisfaction,
      phaseBeforeShop
    } = get();

    if (!businessDay || businessDay.isCompleted || !currentOrder) {
      return;
    }

    const nowMs = Date.now();
    const responseTime = (nowMs - orderStartedAtMs) / 1000;
    const result = evaluateOrder(currentOrder, currentInput);
    const isCorrect = result.isCorrect;

    const nextProgressMap = { ...wordProgressMap };
    const pendingSet = new Set(businessDay.pendingCorrectionWordIds);

    let masteredGain = 0;
    let correctedMistakesGain = 0;
    const lineMastery: Array<{ german: string; next: WordProgress; becameMastered: boolean }> = [];

    currentOrder.lines.forEach((line) => {
      const prev = nextProgressMap[line.wordId];
      const entry = updateWordProgressEntry(
        prev,
        line.wordId,
        isCorrect,
        responseTime,
        normalizeInput(currentInput),
        line.german
      );

      nextProgressMap[line.wordId] = entry.next;
      lineMastery.push({
        german: line.german,
        next: entry.next,
        becameMastered: entry.becameMastered
      });

      if (entry.becameMastered) {
        masteredGain += 1;
      }

      if (isCorrect) {
        if (pendingSet.has(line.wordId)) {
          correctedMistakesGain += 1;
          pendingSet.delete(line.wordId);
        }
      } else {
        pendingSet.add(line.wordId);
      }
    });

    const nextDay: BusinessDay = {
      ...businessDay,
      progress: {
        newMastered: businessDay.progress.newMastered + masteredGain,
        correctedMistakes: businessDay.progress.correctedMistakes + correctedMistakesGain,
        servedOrders: businessDay.progress.servedOrders + 1,
        correctOrders: businessDay.progress.correctOrders + (isCorrect ? 1 : 0)
      },
      pendingCorrectionWordIds: Array.from(pendingSet)
    };

    const satisfactionDelta = isCorrect ? 2 : -9;
    const nextSatisfaction: SatisfactionState = {
      ...satisfaction,
      current: clamp(satisfaction.current + satisfactionDelta, satisfaction.min, satisfaction.max)
    };

    const gain = coinRewardForOrder(currentOrder.type, nextSatisfaction, isCorrect);
    const nextCoins: CoinWallet = {
      ...coins,
      balance: coins.balance + gain,
      earnedToday: coins.earnedToday + gain
    };

    const verbPastTenseNote = isCorrect ? buildVerbPastTenseNote(currentOrder) : undefined;
    const mergedNote = [result.note, verbPastTenseNote].filter(Boolean).join('；');
    const masteryHint = buildMasteryHint(lineMastery, currentOrder.type, isCorrect);
    const feedbackType: GameFeedback['type'] = isCorrect ? 'correct' : 'wrong';

    const feedback: GameFeedback = {
      type: feedbackType,
      title: isCorrect ? '订单判定：正确' : '订单判定：错误',
      speech: pickFeedbackSpeech(feedbackType),
      correctAnswer: buildCorrectAnswerText(currentOrder),
      userInput: currentInput,
      note: mergedNote || undefined,
      masteryHint,
      requiresManualContinue: !isCorrect
    };

    const nextAnswer: GameAnswer = {
      sessionId: businessDay.id,
      orderId: currentOrder.id,
      orderType: currentOrder.type,
      wordIds: currentOrder.lines.map((line) => line.wordId),
      userInput: normalizeInput(currentInput),
      correctAnswer: buildCorrectAnswerText(currentOrder),
      isCorrect,
      responseTime,
      timestamp: new Date(nowMs).toISOString(),
      feedbackType: isCorrect ? 'correct' : 'wrong'
    };

    saveWordProgressMap(nextProgressMap);
    saveCoinWallet(nextCoins);

    set({
      wordProgressMap: nextProgressMap,
      businessDay: nextDay,
      satisfaction: nextSatisfaction,
      coins: nextCoins,
      feedback,
      currentInput: '',
      phase: 'show_order_feedback',
      answers: [...answers, nextAnswer]
    });

    const completed = isDayGoalCompleted(nextDay.progress, nextDay.goal);
    if (completed) {
      get().completeDayIfGoalMet();
      return;
    }

    persistRuntimeFromState({
      businessDay: nextDay,
      currentOrder,
      orderQueue,
      satisfaction: nextSatisfaction,
      phase: 'show_order_feedback',
      phaseBeforeShop
    });
  },

  skipOrder: () => {
    const { businessDay, currentOrder, currentInput, answers, satisfaction, orderQueue, phaseBeforeShop } = get();

    if (!businessDay || businessDay.isCompleted || !currentOrder) {
      return;
    }

    const pendingSet = new Set(businessDay.pendingCorrectionWordIds);
    currentOrder.lines.forEach((line) => pendingSet.add(line.wordId));

    const nextDay: BusinessDay = {
      ...businessDay,
      progress: {
        ...businessDay.progress,
        servedOrders: businessDay.progress.servedOrders + 1
      },
      pendingCorrectionWordIds: Array.from(pendingSet)
    };

    const nextSatisfaction: SatisfactionState = {
      ...satisfaction,
      current: clamp(satisfaction.current - 6, satisfaction.min, satisfaction.max)
    };

    const nextAnswer: GameAnswer = {
      sessionId: businessDay.id,
      orderId: currentOrder.id,
      orderType: currentOrder.type,
      wordIds: currentOrder.lines.map((line) => line.wordId),
      userInput: normalizeInput(currentInput),
      correctAnswer: buildCorrectAnswerText(currentOrder),
      isCorrect: false,
      timestamp: new Date().toISOString(),
      feedbackType: 'skip'
    };

    const feedback: GameFeedback = {
      type: 'skip',
      title: '订单判定：已跳过',
      speech: pickFeedbackSpeech('skip'),
      correctAnswer: buildCorrectAnswerText(currentOrder),
      userInput: currentInput,
      note: '满意度下降，已记录待复习词。',
      masteryHint: '本题已跳过，不计入新增掌握词。',
      requiresManualContinue: true
    };

    set({
      businessDay: nextDay,
      satisfaction: nextSatisfaction,
      feedback,
      currentInput: '',
      phase: 'show_order_feedback',
      answers: [...answers, nextAnswer]
    });

    persistRuntimeFromState({
      businessDay: nextDay,
      currentOrder,
      orderQueue,
      satisfaction: nextSatisfaction,
      phase: 'show_order_feedback',
      phaseBeforeShop
    });
  },

  continueAfterFeedback: () => {
    const { businessDay, phase, feedback, orderQueue, allWords, wordProgressMap, satisfaction } = get();

    if (phase !== 'show_order_feedback' || !businessDay || businessDay.isCompleted) {
      return;
    }

    if (feedback?.requiresManualContinue === true && feedback.type === 'wrong') {
      // Manual continue is handled by Enter or explicit button; calling this is fine.
    }

    const shiftedQueue = [...orderQueue.slice(1)];
    const normalizedQueue = normalizeQueueNoAdjacentSameCustomer(
      shiftedQueue,
      allWords,
      wordProgressMap,
      businessDay.pendingCorrectionWordIds
    );
    const nextQueue = fillQueueToSize(
      normalizedQueue,
      allWords,
      wordProgressMap,
      businessDay.pendingCorrectionWordIds
    );

    const nextCurrent = nextQueue[0] ?? null;

    set({
      orderQueue: nextQueue,
      currentOrder: nextCurrent,
      feedback: null,
      phase: 'serving_order',
      currentInput: '',
      orderStartedAtMs: Date.now()
    });

    persistRuntimeFromState({
      businessDay,
      currentOrder: nextCurrent,
      orderQueue: nextQueue,
      satisfaction,
      phase: 'serving_order',
      phaseBeforeShop: null
    });
  },

  redeemSausage: (skinId) => {
    const { coins, collection } = get();
    const skin = SAUSAGE_CATALOG.find((item) => item.id === skinId);

    if (!skin || collection.ownedSkinIds.includes(skinId) || coins.balance < skin.price) {
      return;
    }

    const nextCoins: CoinWallet = {
      ...coins,
      balance: coins.balance - skin.price,
      spentToday: coins.spentToday + skin.price
    };

    const nextCollection: SausageCollection = {
      ...collection,
      ownedSkinIds: [...collection.ownedSkinIds, skinId],
      displaySkinId: skinId
    };

    set({ coins: nextCoins, collection: nextCollection });
    saveCoinWallet(nextCoins);
    saveSausageCollection(nextCollection);
  },

  setDisplaySausage: (skinId) => {
    const { collection } = get();
    if (!collection.ownedSkinIds.includes(skinId)) {
      return;
    }

    const nextCollection: SausageCollection = {
      ...collection,
      displaySkinId: skinId
    };

    set({ collection: nextCollection });
    saveSausageCollection(nextCollection);
  },

  resetAllLocalData: () => {
    Object.values(storageKeyMap).forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore browser storage errors.
      }
    });

    const nextSettings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      lastIntroDate: undefined
    });

    set({
      isInitialized: true,
      allWords: DEFAULT_WORDS,
      learningUnits: [],
      unitWordsMap: {},
      activeUnitId: null,
      phase: 'serving_order',
      phaseBeforeShop: null,
      currentOrder: null,
      orderQueue: [],
      businessDay: null,
      feedback: null,
      currentInput: '',
      orderStartedAtMs: Date.now(),
      answers: [],
      satisfaction: DEFAULT_SATISFACTION,
      coins: DEFAULT_WALLET,
      collection: DEFAULT_COLLECTION,
      wordProgressMap: {},
      importReport: null,
      settings: nextSettings,
      aiDraft: null,
      aiState: 'idle',
      aiError: null
    });

    clearRuntimeSnapshot();
    clearLegacyImportedWords();
    saveGameSettings(nextSettings);
    saveCoinWallet(DEFAULT_WALLET);
    saveSausageCollection(DEFAULT_COLLECTION);
    saveLearningUnits([]);
    saveUnitWordsMap({});
    saveActiveUnitId(null);

    get().startBusinessDay();
  },

  updateSettings: (patch) => {
    const nextSettings = normalizeSettings({
      ...get().settings,
      ...patch
    });

    saveGameSettings(nextSettings);
    set({ settings: nextSettings });
  },

  importWordsFromJsonText: (raw, unitName) => {
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

      const state = get();
      const { unit, unitWords } = buildUnitFromWords(validWords, unitName, state.learningUnits);
      const nextUnits = [unit, ...state.learningUnits];
      const nextMap: UnitWordsMap = {
        ...state.unitWordsMap,
        [unit.id]: unitWords
      };
      const nextAllWords = rebuildAllWords(nextMap, unit.id);

      saveLearningUnits(nextUnits);
      saveUnitWordsMap(nextMap);
      saveActiveUnitId(unit.id);

      const refreshed = rebuildRunningDayForNewPool({
        businessDay: state.businessDay,
        allWords: nextAllWords,
        settings: state.settings,
        wordProgressMap: state.wordProgressMap
      });
      const nextPhase: GamePhase = state.phase === 'show_order_feedback' ? 'serving_order' : state.phase;

      set({
        learningUnits: nextUnits,
        unitWordsMap: nextMap,
        activeUnitId: unit.id,
        allWords: nextAllWords,
        businessDay: refreshed?.businessDay ?? state.businessDay,
        orderQueue: refreshed?.orderQueue ?? state.orderQueue,
        currentOrder: refreshed?.currentOrder ?? state.currentOrder,
        feedback: refreshed ? null : state.feedback,
        currentInput: refreshed ? '' : state.currentInput,
        orderStartedAtMs: refreshed ? Date.now() : state.orderStartedAtMs,
        phase: refreshed ? nextPhase : state.phase,
        importReport: {
          addedWords: unitWords.length,
          errors: [],
          message: buildUnitMessage(unit.name, unitWords.length)
        }
      });

      if (refreshed) {
        persistRuntimeFromState({
          businessDay: refreshed.businessDay,
          currentOrder: refreshed.currentOrder,
          orderQueue: refreshed.orderQueue,
          satisfaction: state.satisfaction,
          phase: nextPhase,
          phaseBeforeShop: state.phaseBeforeShop
        });
      }
    } catch {
      set({
        importReport: {
          addedWords: 0,
          errors: [{ index: -1, field: 'json', message: 'JSON 解析失败，请检查文件格式。' }]
        }
      });
    }
  },

  generateWordsFromText: async (rawText, unitName) => {
    if (!rawText.trim()) {
      set({ aiState: 'error', aiError: '请输入词表文本后再生成。' });
      return;
    }

    set({ aiState: 'loading', aiError: null, aiDraft: null });

    try {
      const response = await fetch('/api/units/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          unitName,
          rawWordListText: rawText
        })
      });

      if (!response.ok) {
        throw new Error(`AI 服务异常：HTTP ${response.status}`);
      }

      const payload = await response.json() as {
        suggestedUnitName?: string;
        words?: unknown;
      };

      const suggestedName = normalizeUnitName(payload.suggestedUnitName ?? unitName, 'AI 生成单元');
      const { validWords, errors } = validateWords(payload.words);

      if (errors.length > 0) {
        set({
          aiState: 'error',
          aiError: `AI 返回数据不符合导入规范：${errors[0]?.field} ${errors[0]?.message}`,
          aiDraft: null
        });
        return;
      }

      set({
        aiState: 'ready',
        aiError: null,
        aiDraft: {
          suggestedUnitName: suggestedName,
          words: validWords
        }
      });
    } catch (error) {
      set({
        aiState: 'error',
        aiError: error instanceof Error ? error.message : 'AI 生成失败，请稍后再试。',
        aiDraft: null
      });
    }
  },

  saveGeneratedDraft: (unitName) => {
    const state = get();
    const {
      aiDraft,
      learningUnits,
      unitWordsMap,
      businessDay,
      settings,
      wordProgressMap,
      orderQueue,
      currentOrder,
      feedback,
      currentInput,
      orderStartedAtMs,
      phase,
      phaseBeforeShop,
      satisfaction
    } = state;
    if (!aiDraft) {
      return;
    }

    const { unit, unitWords } = buildUnitFromWords(
      aiDraft.words,
      unitName ?? aiDraft.suggestedUnitName,
      learningUnits
    );

    const nextUnits = [unit, ...learningUnits];
    const nextMap: UnitWordsMap = {
      ...unitWordsMap,
      [unit.id]: unitWords
    };

    saveLearningUnits(nextUnits);
    saveUnitWordsMap(nextMap);
    saveActiveUnitId(unit.id);

    const nextAllWords = rebuildAllWords(nextMap, unit.id);
    const refreshed = rebuildRunningDayForNewPool({
      businessDay,
      allWords: nextAllWords,
      settings,
      wordProgressMap
    });
    const nextPhase: GamePhase = phase === 'show_order_feedback' ? 'serving_order' : phase;

    set({
      learningUnits: nextUnits,
      unitWordsMap: nextMap,
      activeUnitId: unit.id,
      allWords: nextAllWords,
      businessDay: refreshed?.businessDay ?? businessDay,
      orderQueue: refreshed?.orderQueue ?? orderQueue,
      currentOrder: refreshed?.currentOrder ?? currentOrder,
      feedback: refreshed ? null : feedback,
      currentInput: refreshed ? '' : currentInput,
      orderStartedAtMs: refreshed ? Date.now() : orderStartedAtMs,
      phase: refreshed ? nextPhase : phase,
      importReport: {
        addedWords: unitWords.length,
        errors: [],
        message: buildUnitMessage(unit.name, unitWords.length)
      },
      aiDraft: null,
      aiState: 'idle',
      aiError: null
    });

    if (refreshed) {
      persistRuntimeFromState({
        businessDay: refreshed.businessDay,
        currentOrder: refreshed.currentOrder,
        orderQueue: refreshed.orderQueue,
        satisfaction,
        phase: nextPhase,
        phaseBeforeShop
      });
    }
  },

  clearGeneratedDraft: () => {
    set({ aiDraft: null, aiState: 'idle', aiError: null });
  },

  clearImportReport: () => set({ importReport: null }),

  setActiveLearningUnit: (unitId) => {
    const state = get();
    const {
      learningUnits,
      unitWordsMap,
      businessDay,
      settings,
      wordProgressMap,
      orderQueue,
      currentOrder,
      feedback,
      currentInput,
      orderStartedAtMs,
      phase,
      phaseBeforeShop,
      satisfaction
    } = state;

    if (unitId !== null && !learningUnits.some((unit) => unit.id === unitId)) {
      return;
    }

    const nextAllWords = rebuildAllWords(unitWordsMap, unitId);
    const refreshed = rebuildRunningDayForNewPool({
      businessDay,
      allWords: nextAllWords,
      settings,
      wordProgressMap
    });
    const nextPhase: GamePhase = phase === 'show_order_feedback' ? 'serving_order' : phase;

    saveActiveUnitId(unitId);
    set({
      activeUnitId: unitId,
      allWords: nextAllWords,
      businessDay: refreshed?.businessDay ?? businessDay,
      orderQueue: refreshed?.orderQueue ?? orderQueue,
      currentOrder: refreshed?.currentOrder ?? currentOrder,
      feedback: refreshed ? null : feedback,
      currentInput: refreshed ? '' : currentInput,
      orderStartedAtMs: refreshed ? Date.now() : orderStartedAtMs,
      phase: refreshed ? nextPhase : phase
    });

    if (refreshed) {
      persistRuntimeFromState({
        businessDay: refreshed.businessDay,
        currentOrder: refreshed.currentOrder,
        orderQueue: refreshed.orderQueue,
        satisfaction,
        phase: nextPhase,
        phaseBeforeShop
      });
    }
  },

  renameLearningUnit: (unitId, nextName) => {
    const normalized = nextName.trim();
    if (!normalized) {
      return;
    }

    const nextUnits = get().learningUnits.map((unit) => {
      if (unit.id !== unitId) {
        return unit;
      }

      return {
        ...unit,
        name: normalized,
        updatedAt: new Date().toISOString()
      };
    });

    saveLearningUnits(nextUnits);
    set({ learningUnits: nextUnits });
  },

  deleteLearningUnit: (unitId) => {
    const state = get();
    const {
      learningUnits,
      unitWordsMap,
      activeUnitId,
      wordProgressMap,
      businessDay,
      settings,
      orderQueue,
      currentOrder,
      feedback,
      currentInput,
      orderStartedAtMs,
      phase,
      phaseBeforeShop,
      satisfaction
    } = state;
    if (!learningUnits.some((unit) => unit.id === unitId)) {
      return;
    }

    const nextUnits = learningUnits.filter((unit) => unit.id !== unitId);
    const nextMap: UnitWordsMap = { ...unitWordsMap };
    delete nextMap[unitId];

    const nextActiveUnitId =
      activeUnitId === unitId
        ? (nextUnits[0]?.id ?? null)
        : activeUnitId;

    const prefix = `${unitId}::`;
    const nextProgressMap = Object.fromEntries(
      Object.entries(wordProgressMap).filter(([wordId]) => !wordId.startsWith(prefix))
    );

    saveLearningUnits(nextUnits);
    saveUnitWordsMap(nextMap);
    saveActiveUnitId(nextActiveUnitId);
    saveWordProgressMap(nextProgressMap);

    const nextAllWords = rebuildAllWords(nextMap, nextActiveUnitId);
    const refreshed = rebuildRunningDayForNewPool({
      businessDay,
      allWords: nextAllWords,
      settings,
      wordProgressMap: nextProgressMap
    });
    const nextPhase: GamePhase = phase === 'show_order_feedback' ? 'serving_order' : phase;

    set({
      learningUnits: nextUnits,
      unitWordsMap: nextMap,
      activeUnitId: nextActiveUnitId,
      allWords: nextAllWords,
      wordProgressMap: nextProgressMap,
      businessDay: refreshed?.businessDay ?? businessDay,
      orderQueue: refreshed?.orderQueue ?? orderQueue,
      currentOrder: refreshed?.currentOrder ?? currentOrder,
      feedback: refreshed ? null : feedback,
      currentInput: refreshed ? '' : currentInput,
      orderStartedAtMs: refreshed ? Date.now() : orderStartedAtMs,
      phase: refreshed ? nextPhase : phase
    });

    if (refreshed) {
      persistRuntimeFromState({
        businessDay: refreshed.businessDay,
        currentOrder: refreshed.currentOrder,
        orderQueue: refreshed.orderQueue,
        satisfaction,
        phase: nextPhase,
        phaseBeforeShop
      });
    }
  }
}));

export const getCurrentOrder = (order: Order | null): Order | null => order;

export const getDayAccuracy = (progress: DayProgress | null): number => {
  if (!progress || progress.servedOrders === 0) {
    return 0;
  }

  return Math.round((progress.correctOrders / progress.servedOrders) * 100);
};

export const dayGoalDefault = DEFAULT_DAY_GOAL;
