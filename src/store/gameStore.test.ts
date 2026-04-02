import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDynamicDayGoal,
  countRemainingUnmastered,
  getPlanProgress,
  resolveLearningPool,
  useGameStore
} from './gameStore';
import { saveGameSettings, saveRuntimeSnapshot } from '../lib/storage';
import type { Word, WordProgress } from '../types';

const words: Word[] = [
  {
    id: 'builtin-a1',
    english: 'apple',
    german: 'der Apfel',
    category: 'food',
    sourceType: 'builtin'
  },
  {
    id: 'builtin-b1',
    english: 'opinion',
    german: 'die Meinung',
    category: 'abstract',
    sourceType: 'builtin'
  },
  {
    id: 'imported-1',
    english: 'cloud',
    german: 'die Wolke',
    category: 'nature',
    sourceType: 'imported'
  }
];

const toLocalDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

describe('resolveLearningPool', () => {
  it('prefers imported words when user has uploaded words', () => {
    const pool = resolveLearningPool(words);

    expect(pool).toHaveLength(1);
    expect(pool[0]?.id).toBe('imported-1');
  });

  it('falls back to built-in pool when no imported words exist', () => {
    const pool = resolveLearningPool(words.filter((word) => word.sourceType !== 'imported'));

    expect(pool).toHaveLength(2);
    expect(pool.map((word) => word.id)).toEqual(expect.arrayContaining(['builtin-a1', 'builtin-b1']));
  });
});

describe('getPlanProgress', () => {
  it('returns full days left when today is before plan start', () => {
    const result = getPlanProgress('2026-04-10T00:00:00.000Z', 7, new Date('2026-04-02T10:00:00.000Z'));

    expect(result.dayIndex).toBe(1);
    expect(result.daysLeft).toBe(7);
  });

  it('enters catch-up mode with daysLeft = 1 after deadline', () => {
    const result = getPlanProgress('2026-03-20T00:00:00.000Z', 7, new Date('2026-04-02T10:00:00.000Z'));

    expect(result.daysLeft).toBe(1);
  });
});

describe('dynamic day goal helpers', () => {
  it('splits remaining goals by remaining days using ceil', () => {
    const goal = buildDynamicDayGoal(10, 3, 4);

    expect(goal.newMasteredTarget).toBe(3);
    expect(goal.correctedMistakesTarget).toBe(1);
  });

  it('counts only words with mastery < 3 as remaining', () => {
    const progressMap: Record<string, WordProgress> = {
      'imported-1': {
        wordId: 'imported-1',
        attempts: 4,
        correct: 4,
        masteryLevel: 3,
        lastReviewDate: '2026-04-01T00:00:00.000Z',
        nextReviewDate: '2026-04-07T00:00:00.000Z',
        averageResponseTime: 1,
        errorPatterns: []
      },
      'builtin-a1': {
        wordId: 'builtin-a1',
        attempts: 1,
        correct: 0,
        masteryLevel: 0,
        lastReviewDate: '2026-04-01T00:00:00.000Z',
        nextReviewDate: '2026-04-02T00:00:00.000Z',
        averageResponseTime: 3,
        errorPatterns: ['wrong']
      }
    };

    const remaining = countRemainingUnmastered(words, progressMap);
    expect(remaining).toBe(2);
  });
});

describe('mastery feedback messaging', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().resetAllLocalData();
  });

  it('keeps newMastered unchanged and explains threshold when answer is correct but not yet mastered', () => {
    const state = useGameStore.getState();
    const businessDay = state.businessDay;
    const word = state.allWords[0];

    expect(businessDay).not.toBeNull();
    expect(word).toBeDefined();

    const order = {
      id: 'order_mastery_hint',
      type: 'translation' as const,
      customer: {
        id: 'cust_mastery_hint',
        name: 'Anna',
        tier: 'regular' as const,
        avatar: '🧑‍🍳'
      },
      lines: [
        {
          wordId: word!.id,
          english: word!.english,
          german: word!.german,
          category: word!.category,
          pastTense: word!.pastTense
        }
      ],
      prompt: `顾客点单：${word!.english}`,
      instruction: '请输入完整德语拼写（含冠词时请一起输入）。'
    };

    useGameStore.setState({
      phase: 'serving_order',
      businessDay: {
        ...businessDay!,
        goal: {
          newMasteredTarget: 99,
          correctedMistakesTarget: 99
        },
        progress: {
          newMastered: 0,
          correctedMistakes: 0,
          servedOrders: 0,
          correctOrders: 0
        }
      },
      currentOrder: order,
      orderQueue: [order],
      currentInput: word!.german,
      orderStartedAtMs: Date.now() - 1500,
      wordProgressMap: {
        [word!.id]: {
          wordId: word!.id,
          attempts: 1,
          correct: 0,
          masteryLevel: 0,
          lastReviewDate: '2026-04-01T00:00:00.000Z',
          nextReviewDate: '2026-04-02T00:00:00.000Z',
          averageResponseTime: 2,
          errorPatterns: []
        }
      }
    });

    useGameStore.getState().submitOrderAnswer();

    const after = useGameStore.getState();
    expect(after.businessDay?.progress.newMastered).toBe(0);
    expect(after.feedback?.type).toBe('correct');
    expect(after.feedback?.speech.length ?? 0).toBeGreaterThan(0);
    expect(after.feedback?.masteryHint).toContain('本题答对，但未达掌握阈值');
  });

  it('increments newMastered when mastery reaches level 3 and reports it in hint', () => {
    const state = useGameStore.getState();
    const businessDay = state.businessDay;
    const word = state.allWords[0];

    expect(businessDay).not.toBeNull();
    expect(word).toBeDefined();

    const order = {
      id: 'order_mastery_reached',
      type: 'translation' as const,
      customer: {
        id: 'cust_mastery_reached',
        name: 'Lukas',
        tier: 'regular' as const,
        avatar: '👨‍🔧'
      },
      lines: [
        {
          wordId: word!.id,
          english: word!.english,
          german: word!.german,
          category: word!.category,
          pastTense: word!.pastTense
        }
      ],
      prompt: `顾客点单：${word!.english}`,
      instruction: '请输入完整德语拼写（含冠词时请一起输入）。'
    };

    useGameStore.setState({
      phase: 'serving_order',
      businessDay: {
        ...businessDay!,
        goal: {
          newMasteredTarget: 99,
          correctedMistakesTarget: 99
        },
        progress: {
          newMastered: 0,
          correctedMistakes: 0,
          servedOrders: 0,
          correctOrders: 0
        }
      },
      currentOrder: order,
      orderQueue: [order],
      currentInput: word!.german,
      orderStartedAtMs: Date.now() - 1500,
      wordProgressMap: {
        [word!.id]: {
          wordId: word!.id,
          attempts: 4,
          correct: 3,
          masteryLevel: 2,
          lastReviewDate: '2026-04-01T00:00:00.000Z',
          nextReviewDate: '2026-04-02T00:00:00.000Z',
          averageResponseTime: 2,
          errorPatterns: []
        }
      }
    });

    useGameStore.getState().submitOrderAnswer();

    const after = useGameStore.getState();
    expect(after.businessDay?.progress.newMastered).toBe(1);
    expect(after.feedback?.type).toBe('correct');
    expect(after.feedback?.masteryHint).toContain('达到 masteryLevel 3');
  });
});

describe('updatePlanDaysForCurrentDay', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().resetAllLocalData();
  });

  it('updates planDays and recomputes current day goal immediately', () => {
    const before = useGameStore.getState();
    const beforeDay = before.businessDay;

    expect(beforeDay).not.toBeNull();

    useGameStore.getState().updatePlanDaysForCurrentDay(30);

    const after = useGameStore.getState();
    const afterDay = after.businessDay;

    expect(after.settings.planDays).toBe(30);
    expect(afterDay).not.toBeNull();
    expect(afterDay?.planDaysLeft).toBeGreaterThanOrEqual(beforeDay?.planDaysLeft ?? 1);
    expect(new Date(afterDay?.goalComputedAt ?? '').getTime()).toBeGreaterThanOrEqual(
      new Date(beforeDay?.goalComputedAt ?? '').getTime()
    );

    const beforeGoal = beforeDay?.goal.newMasteredTarget ?? 0;
    const afterGoal = afterDay?.goal.newMasteredTarget ?? 0;
    expect(afterGoal).toBeLessThanOrEqual(beforeGoal);
  });
});

describe('intro entry behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().resetAllLocalData();
  });

  it('restores runtime progress but always enters intro_door on initializeGame', () => {
    const current = useGameStore.getState();
    const businessDay = current.businessDay;
    expect(businessDay).not.toBeNull();

    const runtimeBusinessDay = {
      ...businessDay!,
      progress: {
        ...businessDay!.progress,
        newMastered: 3
      }
    };

    saveRuntimeSnapshot({
      businessDay: runtimeBusinessDay,
      orderQueue: current.orderQueue,
      currentOrder: current.currentOrder,
      satisfaction: current.satisfaction,
      phase: 'serving_order',
      phaseBeforeShop: null
    });

    saveGameSettings({
      ...current.settings,
      lastIntroDate: toLocalDateKey(new Date())
    });

    useGameStore.setState({
      phase: 'shop',
      businessDay: null
    });

    useGameStore.getState().initializeGame();

    const restored = useGameStore.getState();
    expect(restored.phase).toBe('intro_door');
    expect(restored.businessDay?.progress.newMastered).toBe(3);
  });

  it('starts every new business day from intro_door even when lastIntroDate is today', () => {
    const todayKey = toLocalDateKey(new Date());

    useGameStore.getState().updateSettings({
      lastIntroDate: todayKey
    });
    useGameStore.getState().startBusinessDay();

    const state = useGameStore.getState();
    expect(state.phase).toBe('intro_door');
  });
});
