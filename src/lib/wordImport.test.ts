import { describe, expect, it } from 'vitest';
import { validateWords } from './wordImport';

describe('validateWords', () => {
  it('accepts valid records', () => {
    const payload = [
      {
        id: 'custom-1',
        english: 'apple',
        german: 'der Apfel',
        category: 'food',
        difficulty: 'A1'
      }
    ];

    const result = validateWords(payload);
    expect(result.errors).toHaveLength(0);
    expect(result.validWords).toHaveLength(1);
    expect(result.validWords[0]?.sourceType).toBe('imported');
  });

  it('rejects missing required fields', () => {
    const payload = [{ english: 'apple', german: 'der Apfel' }];
    const result = validateWords(payload);

    expect(result.errors.length).toBeGreaterThan(0);
  });
});
