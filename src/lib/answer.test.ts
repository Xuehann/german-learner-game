import { describe, expect, it } from 'vitest';
import { buildHint, evaluateAnswer } from './answer';

describe('evaluateAnswer', () => {
  it('accepts exact answer', () => {
    expect(evaluateAnswer('der Apfel', 'der Apfel').isCorrect).toBe(true);
  });

  it('accepts case mismatch as correct', () => {
    const result = evaluateAnswer('der apfel', 'der Apfel');
    expect(result.isCorrect).toBe(true);
    expect(result.note).toContain('首字母大写');
  });

  it('rejects different spelling', () => {
    expect(evaluateAnswer('der appel', 'der Apfel').isCorrect).toBe(false);
  });
});

describe('buildHint', () => {
  it('returns masked hint', () => {
    expect(buildHint('der Apfel')).toBe('der______');
  });
});
