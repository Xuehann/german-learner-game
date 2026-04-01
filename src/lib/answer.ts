const DE_LOCALE = 'de-DE';

const squeezeWhitespace = (input: string) => input.trim().replace(/\s+/g, ' ');

const hasArticle = (value: string) => /^(der|die|das)\s+/i.test(value);

export interface AnswerEvaluation {
  isCorrect: boolean;
  note?: string;
}

export const evaluateAnswer = (userInput: string, correctAnswer: string): AnswerEvaluation => {
  const cleanedUser = squeezeWhitespace(userInput);
  const cleanedCorrect = squeezeWhitespace(correctAnswer);

  if (!cleanedUser) {
    return { isCorrect: false, note: '请输入德语答案。' };
  }

  if (cleanedUser === cleanedCorrect) {
    return { isCorrect: true };
  }

  if (cleanedUser.toLocaleLowerCase(DE_LOCALE) === cleanedCorrect.toLocaleLowerCase(DE_LOCALE)) {
    const note = hasArticle(cleanedCorrect) ? '注意：德语名词通常需要首字母大写。' : undefined;
    return { isCorrect: true, note };
  }

  return { isCorrect: false };
};

export const buildHint = (correctAnswer: string): string => {
  const trimmed = squeezeWhitespace(correctAnswer);
  if (trimmed.length <= 2) {
    return trimmed;
  }

  const visible = Math.max(1, Math.floor(trimmed.length / 3));
  return `${trimmed.slice(0, visible)}${'_'.repeat(trimmed.length - visible)}`;
};
