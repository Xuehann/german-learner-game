import type { Difficulty, ImportResult, ImportValidationError, Word } from '../types';
import { loadImportedWords, saveImportedWords } from './storage';

const VALID_DIFFICULTIES: Difficulty[] = ['A1', 'A2', 'B1'];

const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && VALID_DIFFICULTIES.includes(value as Difficulty);

const normalizeWord = (word: Word): Word => ({
  ...word,
  id: word.id.trim(),
  english: word.english.trim(),
  german: word.german.trim(),
  category: word.category.trim(),
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

    const candidate = row as Partial<Word>;

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

    if (!isDifficulty(candidate.difficulty)) {
      errors.push({ index, field: 'difficulty', message: 'difficulty 仅支持 A1/A2/B1。' });
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

export const commitWords = (words: Word[]): ImportResult => {
  const existing = loadImportedWords();
  const map = new Map<string, Word>(existing.map((word) => [word.id, word]));

  words.forEach((word) => {
    map.set(word.id, { ...word, sourceType: 'imported' });
  });

  const merged = Array.from(map.values());
  saveImportedWords(merged);

  return {
    addedWords: words.length,
    errors: []
  };
};
