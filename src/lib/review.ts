export const computeMasteryLevel = (attempts: number, correct: number): 0 | 1 | 2 | 3 => {
  if (attempts < 2) {
    return 0;
  }

  const accuracy = correct / attempts;

  if (accuracy < 0.5) {
    return 1;
  }

  if (accuracy < 0.8) {
    return 2;
  }

  return 3;
};

export const computeNextReviewDate = (masteryLevel: 0 | 1 | 2 | 3, now: Date): string => {
  const daysByLevel: Record<0 | 1 | 2 | 3, number> = {
    0: 1,
    1: 2,
    2: 4,
    3: 7
  };

  const next = new Date(now);
  next.setDate(next.getDate() + daysByLevel[masteryLevel]);
  return next.toISOString();
};
