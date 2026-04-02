import { describe, expect, it } from 'vitest';
import {
  coinRewardForOrder,
  DEFAULT_DAY_GOAL,
  isDayGoalCompleted
} from './businessRules';

const lowSatisfaction = { current: 25, min: 20, max: 100 };
const highSatisfaction = { current: 95, min: 20, max: 100 };

describe('businessRules', () => {
  it('marks day completed only when both learning targets are met', () => {
    expect(
      isDayGoalCompleted(
        { newMastered: 3, correctedMistakes: 5, servedOrders: 9, correctOrders: 7 },
        DEFAULT_DAY_GOAL
      )
    ).toBe(true);

    expect(
      isDayGoalCompleted(
        { newMastered: 2, correctedMistakes: 5, servedOrders: 9, correctOrders: 7 },
        DEFAULT_DAY_GOAL
      )
    ).toBe(false);

    expect(
      isDayGoalCompleted(
        { newMastered: 3, correctedMistakes: 4, servedOrders: 9, correctOrders: 7 },
        DEFAULT_DAY_GOAL
      )
    ).toBe(false);
  });

  it('applies satisfaction only to order coin rewards and gives 0 coin on wrong answers', () => {
    const lowGain = coinRewardForOrder('translation', lowSatisfaction, true);
    const highGain = coinRewardForOrder('translation', highSatisfaction, true);
    const wrongGain = coinRewardForOrder('translation', highSatisfaction, false);

    expect(lowGain).toBeGreaterThan(0);
    expect(highGain).toBeGreaterThan(lowGain);
    expect(wrongGain).toBe(0);
  });

  it('keeps reward model with translation/review/combo only', () => {
    expect(coinRewardForOrder('translation', highSatisfaction, true)).toBeGreaterThan(0);
    expect(coinRewardForOrder('review', highSatisfaction, true)).toBeGreaterThan(0);
    expect(coinRewardForOrder('combo', highSatisfaction, true)).toBeGreaterThan(0);
  });
});
