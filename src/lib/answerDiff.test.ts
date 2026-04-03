import { describe, expect, it } from 'vitest';
import { buildAnswerDiffTokens } from './answerDiff';

describe('buildAnswerDiffTokens', () => {
  it('returns non-error token for matching input', () => {
    const tokens = buildAnswerDiffTokens('der Apfel', 'der Apfel');
    expect(tokens).toEqual([{ text: 'der Apfel', isError: false }]);
  });

  it('treats case-only difference as non-error', () => {
    const tokens = buildAnswerDiffTokens('der apfel', 'der Apfel');
    expect(tokens).toEqual([{ text: 'der apfel', isError: false }]);
  });

  it('marks wrong letters as error', () => {
    const tokens = buildAnswerDiffTokens('die Apfel', 'der Apfel');
    expect(tokens).toEqual([
      { text: 'd', isError: false },
      { text: 'ie', isError: true },
      { text: ' Apfel', isError: false }
    ]);
  });

  it('uses red placeholder for missing letters', () => {
    const tokens = buildAnswerDiffTokens('der Apf', 'der Apfel');
    expect(tokens).toEqual([
      { text: 'der Apf', isError: false },
      { text: '__', isError: true }
    ]);
  });

  it('shows placeholder sequence when user input is empty', () => {
    const tokens = buildAnswerDiffTokens('', 'der Apfel');
    expect(tokens).toEqual([{ text: '_________', isError: true }]);
  });
});
