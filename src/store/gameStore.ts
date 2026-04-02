import { create } from 'zustand';
import { DEFAULT_WORDS } from '../data/defaultWords';
import { evaluateAnswer } from '../lib/answer';
import { coinRewardForOrder, DEFAULT_DAY_GOAL, isDayGoalCompleted } from '../lib/businessRules';
import { appendSpecialCharacter } from '../lib/germanInput';
import { computeMasteryLevel, computeNextReviewDate } from '../lib/review';
import {
  appendSessionHistory,
  clearRuntimeSnapshot,
  loadCoinWallet,
  loadGameSettings,
  loadImportedWords,
  loadRuntimeSnapshot,
  loadSausageCollection,
  loadWordProgressMap,
  saveCoinWallet,
  saveGameSettings,
  saveRuntimeSnapshot,
  saveSausageCollection,
  saveWordProgressMap
} from '../lib/storage';
import { commitWords, parseJsonWords, validateWords } from '../lib/wordImport';
import type {
  BusinessDay,
  CoinWallet,
  Customer,
  DayProgress,
  Difficulty,
  GameAnswer,
  GameFeedback,
  GamePhase,
  GameSession,
  GameSettings,
  ImportResult,
  Order,
  OrderType,
  SausageCollection,
  SausageSkin,
  SatisfactionState,
  Word,
  WordProgress
} from '../types';

const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'mixed',
  feedbackDelayMs: 1200
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

const CUSTOMER_NAMES = ['Anna', 'Lukas', 'Mia', 'Jonas', 'Lea', 'Noah', 'Emma', 'Paul'];
const CUSTOMER_AVATARS = ['🧑‍🍳', '👨‍🔧', '👩‍💼', '🧔', '👩‍🦰', '🧢'];

const QUEUE_SIZE = 3;
const DAY_CLEAR_BONUS_COINS = 28;

const normalizeInput = (input: string): string => input.trim().replace(/\s+/g, ' ');

const buildDayId = () => `day_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const buildOrderId = () => `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const buildCustomerId = () => `cust_${Math.random().toString(36).slice(2, 8)}`;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const pickOne = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)] as T;

const mergeWords = (builtins: Word[], imported: Word[]): Word[] => {
  const map = new Map<string, Word>();
  builtins.forEach((word) => map.set(word.id, word));
  imported.forEach((word) => map.set(word.id, word));
  return Array.from(map.values());
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

  return scored[scored.length - 1]?.word ?? words[0] as Word;
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
  prompt: `顾客要点单：${word.english}`,
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
  prompt: `组合连单：${first.english} + ${second.english}`,
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
      return { isCorrect: false, note: '组合单需要两个答案，并用逗号分隔。' };
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

const safeWordPool = (allWords: Word[], difficulty: Difficulty | 'mixed'): Word[] => {
  if (difficulty === 'mixed') {
    return allWords;
  }

  const filtered = allWords.filter((word) => word.difficulty === difficulty);
  return filtered.length > 0 ? filtered : allWords;
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
  difficulty: Difficulty | 'mixed',
  progressMap: Record<string, WordProgress>,
  pendingCorrectionWordIds: string[]
): Order => {
  const customer = buildCustomer();
  const pool = safeWordPool(allWords, difficulty);
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
      ...base,
      prompt: `错词回炉：${picked.english}`
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

interface GameState {
  isInitialized: boolean;
  allWords: Word[];
  phase: GamePhase;
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
  initializeGame: () => void;
  startBusinessDay: () => void;
  generateOrder: () => void;
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
  updateSettings: (patch: Partial<GameSettings>) => void;
  importWordsFromJsonText: (raw: string) => void;
  clearImportReport: () => void;
}

const persistRuntimeFromState = (state: {
  businessDay: BusinessDay | null;
  orderQueue: Order[];
  currentOrder: Order | null;
  satisfaction: SatisfactionState;
}) => {
  if (!state.businessDay || state.businessDay.isCompleted) {
    clearRuntimeSnapshot();
    return;
  }

  saveRuntimeSnapshot({
    businessDay: state.businessDay,
    orderQueue: state.orderQueue,
    currentOrder: state.currentOrder,
    satisfaction: state.satisfaction
  });
};

export const useGameStore = create<GameState>((set, get) => ({
  isInitialized: false,
  allWords: DEFAULT_WORDS,
  phase: 'serving_order',
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

  initializeGame: () => {
    const imported = loadImportedWords();
    const mergedWords = mergeWords(DEFAULT_WORDS, imported);
    const settings = loadGameSettings(DEFAULT_SETTINGS);
    const wordProgressMap = loadWordProgressMap();
    const coins = loadCoinWallet(DEFAULT_WALLET);
    const collection = loadSausageCollection(DEFAULT_COLLECTION);
    const runtime = loadRuntimeSnapshot();

    if (runtime && !runtime.businessDay.isCompleted && !hasLegacyArticleOrder(runtime)) {
      set({
        isInitialized: true,
        allWords: mergedWords,
        settings,
        wordProgressMap,
        coins: {
          ...coins,
          earnedToday: 0,
          spentToday: 0
        },
        collection,
        businessDay: runtime.businessDay,
        orderQueue: runtime.orderQueue,
        currentOrder: runtime.currentOrder,
        satisfaction: runtime.satisfaction,
        phase: 'serving_order',
        orderStartedAtMs: Date.now()
      });
      return;
    }

    if (runtime && hasLegacyArticleOrder(runtime)) {
      clearRuntimeSnapshot();
    }

    set({
      isInitialized: true,
      allWords: mergedWords,
      settings,
      wordProgressMap,
      coins,
      collection
    });

    get().startBusinessDay();
  },

  startBusinessDay: () => {
    const { allWords, settings, wordProgressMap, coins } = get();

    const businessDay: BusinessDay = {
      id: buildDayId(),
      startedAt: new Date().toISOString(),
      goal: DEFAULT_DAY_GOAL,
      progress: {
        newMastered: 0,
        correctedMistakes: 0,
        servedOrders: 0,
        correctOrders: 0
      },
      pendingCorrectionWordIds: [],
      isCompleted: false
    };

    const queue: Order[] = [];
    while (queue.length < QUEUE_SIZE) {
      queue.push(buildOrder(allWords, settings.difficulty, wordProgressMap, businessDay.pendingCorrectionWordIds));
    }

    const nextCoins: CoinWallet = {
      ...coins,
      earnedToday: 0,
      spentToday: 0
    };

    set({
      businessDay,
      phase: 'serving_order',
      currentOrder: queue[0] ?? null,
      orderQueue: queue,
      feedback: null,
      currentInput: '',
      orderStartedAtMs: Date.now(),
      answers: [],
      satisfaction: DEFAULT_SATISFACTION,
      coins: nextCoins
    });

    saveCoinWallet(nextCoins);
    persistRuntimeFromState({
      businessDay,
      currentOrder: queue[0] ?? null,
      orderQueue: queue,
      satisfaction: DEFAULT_SATISFACTION
    });
  },

  generateOrder: () => {
    const { allWords, settings, wordProgressMap, businessDay, orderQueue } = get();
    if (!businessDay || businessDay.isCompleted) {
      return;
    }

    const nextOrder = buildOrder(
      allWords,
      settings.difficulty,
      wordProgressMap,
      businessDay.pendingCorrectionWordIds
    );

    const nextQueue = [...orderQueue, nextOrder];
    set({ orderQueue: nextQueue });

    persistRuntimeFromState({
      businessDay,
      currentOrder: get().currentOrder,
      orderQueue: nextQueue,
      satisfaction: get().satisfaction
    });
  },

  setInput: (value) => set({ currentInput: value }),

  appendSpecialChar: (char) => {
    const current = get().currentInput;
    set({ currentInput: appendSpecialCharacter(current, char) });
  },

  updateSatisfaction: (delta) => {
    const { satisfaction, businessDay, orderQueue, currentOrder } = get();
    const nextSatisfaction: SatisfactionState = {
      ...satisfaction,
      current: clamp(satisfaction.current + delta, satisfaction.min, satisfaction.max)
    };

    set({ satisfaction: nextSatisfaction });

    persistRuntimeFromState({
      businessDay,
      currentOrder,
      orderQueue,
      satisfaction: nextSatisfaction
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
    const { businessDay, coins, settings } = get();
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
      difficulty: settings.difficulty,
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
      satisfaction
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

    const feedback: GameFeedback = {
      type: isCorrect ? 'correct' : 'wrong',
      title: isCorrect ? '订单完成，顾客很满意' : '订单出错，顾客开始不耐烦',
      correctAnswer: buildCorrectAnswerText(currentOrder),
      userInput: currentInput,
      note: mergedNote || undefined,
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
      satisfaction: nextSatisfaction
    });
  },

  skipOrder: () => {
    const { businessDay, currentOrder, currentInput, answers, satisfaction, orderQueue } = get();

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
      title: '你跳过了订单',
      correctAnswer: buildCorrectAnswerText(currentOrder),
      userInput: currentInput,
      note: '满意度下降，错词已加入回炉池。',
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
      satisfaction: nextSatisfaction
    });
  },

  continueAfterFeedback: () => {
    const { businessDay, phase, feedback, orderQueue, allWords, settings, wordProgressMap, satisfaction } = get();

    if (phase !== 'show_order_feedback' || !businessDay || businessDay.isCompleted) {
      return;
    }

    if (feedback?.requiresManualContinue === true && feedback.type === 'wrong') {
      // Manual continue is handled by Enter or explicit button; calling this is fine.
    }

    const nextQueue = [...orderQueue.slice(1)];

    while (nextQueue.length < QUEUE_SIZE) {
      nextQueue.push(
        buildOrder(allWords, settings.difficulty, wordProgressMap, businessDay.pendingCorrectionWordIds)
      );
    }

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
      satisfaction
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
      displaySkinId: collection.displaySkinId ?? skinId
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

  updateSettings: (patch) => {
    const nextSettings: GameSettings = {
      ...get().settings,
      ...patch
    };

    saveGameSettings(nextSettings);
    set({ settings: nextSettings });
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

export const getCurrentOrder = (order: Order | null): Order | null => order;

export const getDayAccuracy = (progress: DayProgress | null): number => {
  if (!progress || progress.servedOrders === 0) {
    return 0;
  }

  return Math.round((progress.correctOrders / progress.servedOrders) * 100);
};

export const difficultyOptions: Array<{ label: string; value: Difficulty | 'mixed' }> = [
  { label: '混合', value: 'mixed' },
  { label: 'A1', value: 'A1' },
  { label: 'A2', value: 'A2' },
  { label: 'B1', value: 'B1' }
];

export const dayGoalDefault = DEFAULT_DAY_GOAL;
