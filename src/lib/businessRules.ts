import type { DayGoal, DayProgress, OrderType, SatisfactionState } from '../types';

export const DEFAULT_DAY_GOAL: DayGoal = {
  newMasteredTarget: 3,
  correctedMistakesTarget: 5
};

const BASE_REWARD_BY_ORDER: Record<OrderType, number> = {
  translation: 9,
  review: 10,
  combo: 14
};

export const isDayGoalCompleted = (progress: DayProgress, goal: DayGoal): boolean => {
  return (
    progress.newMastered >= goal.newMasteredTarget &&
    progress.correctedMistakes >= goal.correctedMistakesTarget
  );
};

export const coinRewardForOrder = (
  orderType: OrderType,
  satisfaction: SatisfactionState,
  isCorrect: boolean
): number => {
  if (!isCorrect) {
    return 0;
  }

  const baseReward = BASE_REWARD_BY_ORDER[orderType];
  const ratio = satisfaction.current / satisfaction.max;
  const multiplier = 0.6 + ratio * 0.7;
  return Math.max(1, Math.round(baseReward * multiplier));
};

export const accuracyFromProgress = (progress: DayProgress): number => {
  if (progress.servedOrders === 0) {
    return 0;
  }

  return Math.round((progress.correctOrders / progress.servedOrders) * 100);
};
