import type { ImportValidationError, Word } from '../types';

const normalizeWord = (word: Word): Word => ({
  id: word.id.trim(),
  english: word.english.trim(),
  german: word.german.trim(),
  category: word.category.trim(),
  ...(word.pastTense ? { pastTense: word.pastTense.trim() } : {}),
  ...(word.gender ? { gender: word.gender } : {}),
  ...(word.plural ? { plural: word.plural } : {}),
  ...(word.pronunciation ? { pronunciation: word.pronunciation } : {}),
  ...(word.example ? { example: word.example } : {}),
  sourceType: 'imported'
});

export const parseJsonWords = (raw: string): unknown => {
  return JSON.parse(raw);
};

export const validateWords = (payload: unknown): { validWords: Word[]; errors: ImportValidationError[] } => {
  if (!Array.isArray(payload)) {
    return {
      validWords: [],
      errors: [{ index: -1, field: 'root', message: 'JSON 顶层必须是数组。' }]
    };
  }

  const errors: ImportValidationError[] = [];
  const validWords: Word[] = [];
  const seenIds = new Set<string>();

  payload.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      errors.push({ index, field: 'row', message: '每一项必须是对象。' });
      return;
    }

    const candidate = row as Partial<Word> & { difficulty?: unknown };

    if (!candidate.id || typeof candidate.id !== 'string') {
      errors.push({ index, field: 'id', message: 'id 是必填字符串。' });
      return;
    }

    if (!candidate.english || typeof candidate.english !== 'string') {
      errors.push({ index, field: 'english', message: 'english 是必填字符串。' });
      return;
    }

    if (!candidate.german || typeof candidate.german !== 'string') {
      errors.push({ index, field: 'german', message: 'german 是必填字符串。' });
      return;
    }

    if (!candidate.category || typeof candidate.category !== 'string') {
      errors.push({ index, field: 'category', message: 'category 是必填字符串。' });
      return;
    }

    if (candidate.pastTense !== undefined && typeof candidate.pastTense !== 'string') {
      errors.push({ index, field: 'pastTense', message: 'pastTense 必须是字符串。' });
      return;
    }

    const normalized = normalizeWord(candidate as Word);

    if (seenIds.has(normalized.id)) {
      errors.push({ index, field: 'id', message: `重复 id: ${normalized.id}` });
      return;
    }

    seenIds.add(normalized.id);
    validWords.push(normalized);
  });

  return { validWords, errors };
};
