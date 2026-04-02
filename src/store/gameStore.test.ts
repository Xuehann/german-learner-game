import { describe, expect, it } from 'vitest';
import { buildDynamicDayGoal, countRemainingUnmastered, getPlanProgress, resolveLearningPool } from './gameStore';
import type { Word, WordProgress } from '../types';

const words: Word[] = [
  {
    id: 'builtin-a1',
    english: 'apple',
    german: 'der Apfel',
    category: 'food',
    difficulty: 'A1',
    sourceType: 'builtin'
  },
  {
    id: 'builtin-b1',
    english: 'opinion',
    german: 'die Meinung',
    category: 'abstract',
    difficulty: 'B1',
    sourceType: 'builtin'
  },
  {
    id: 'imported-1',
    english: 'cloud',
    german: 'die Wolke',
    category: 'nature',
    difficulty: 'A1',
    sourceType: 'imported'
  }
];

describe('resolveLearningPool', () => {
  it('prefers imported words when user has uploaded words', () => {
    const pool = resolveLearningPool(words);

    expect(pool).toHaveLength(1);
    expect(pool[0]?.id).toBe('imported-1');
  });

  it('falls back to built-in A1 words when no imported words exist', () => {
    const pool = resolveLearningPool(words.filter((word) => word.sourceType !== 'imported'));

    expect(pool).toHaveLength(1);
    expect(pool[0]?.id).toBe('builtin-a1');
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
