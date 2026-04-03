const DE_LOCALE = 'de-DE';

const squeezeWhitespace = (input: string): string => input.trim().replace(/\s+/g, ' ');

export interface AnswerDiffToken {
  text: string;
  isError: boolean;
}

const pushToken = (tokens: AnswerDiffToken[], char: string, isError: boolean) => {
  const last = tokens[tokens.length - 1];
  if (last && last.isError === isError) {
    last.text += char;
    return;
  }

  tokens.push({ text: char, isError });
};

export const buildAnswerDiffTokens = (userInput: string, correctAnswer: string): AnswerDiffToken[] => {
  const normalizedUser = squeezeWhitespace(userInput);
  const normalizedCorrect = squeezeWhitespace(correctAnswer);

  if (!normalizedUser && !normalizedCorrect) {
    return [{ text: '(空)', isError: false }];
  }

  const maxLength = Math.max(normalizedUser.length, normalizedCorrect.length);
  const tokens: AnswerDiffToken[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const userChar = normalizedUser[index];
    const correctChar = normalizedCorrect[index];

    if (typeof userChar === 'undefined' && typeof correctChar !== 'undefined') {
      pushToken(tokens, '_', true);
      continue;
    }

    if (typeof userChar === 'undefined') {
      continue;
    }

    if (typeof correctChar === 'undefined') {
      pushToken(tokens, userChar, true);
      continue;
    }

    const isMatch = userChar.toLocaleLowerCase(DE_LOCALE) === correctChar.toLocaleLowerCase(DE_LOCALE);
    pushToken(tokens, userChar, !isMatch);
  }

  return tokens.length > 0 ? tokens : [{ text: '(空)', isError: false }];
};
