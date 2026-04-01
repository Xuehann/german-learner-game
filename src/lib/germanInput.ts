export const ALT_CHAR_MAP: Record<string, string> = {
  a: 'ä',
  o: 'ö',
  u: 'ü',
  s: 'ß'
};

export const applyGermanAutoReplace = (input: string): string => {
  let next = input;
  next = next.replace(/ae/g, 'ä');
  next = next.replace(/oe/g, 'ö');
  next = next.replace(/ue/g, 'ü');
  next = next.replace(/ss(\b)/g, 'ß$1');
  return next;
};

export const appendSpecialCharacter = (current: string, char: string): string => `${current}${char}`;
