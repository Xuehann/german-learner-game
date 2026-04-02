import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

type UnitGenerateRequest = {
  unitName?: string;
  rawWordListText?: string;
};

type UnitWord = {
  id: string;
  english: string;
  german: string;
  category: string;
  pastTense?: string;
};

const stripLinePrefix = (line: string): string => line.replace(/^\s*[\d]+[.)、]\s*/, '').trim();

const slugify = (value: string): string => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'word';
};

const parseWordLine = (line: string, index: number): UnitWord | null => {
  const cleaned = stripLinePrefix(line);
  if (!cleaned || cleaned.startsWith('#') || cleaned.startsWith('//')) {
    return null;
  }

  let english = '';
  let german = '';
  let category = 'general';
  let pastTense: string | undefined;

  if (cleaned.includes('|')) {
    const parts = cleaned.split('|').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    [english, german] = [parts[0] ?? '', parts[1] ?? ''];
    category = parts[2] ?? 'general';
    pastTense = parts[3] || undefined;
  } else {
    const pair = cleaned.split(/\s*(?:->|=>|:|：|-|—)\s*/).map((part) => part.trim()).filter(Boolean);
    if (pair.length < 2) {
      return null;
    }

    english = pair[0] ?? '';
    german = pair[1] ?? '';

    if (pair.length >= 3) {
      category = pair[2] ?? 'general';
    }

    if (pair.length >= 4) {
      pastTense = pair[3] || undefined;
    }
  }

  if (!english || !german) {
    return null;
  }

  const idBase = slugify(`${english}-${german}`).slice(0, 28);

  return {
    id: `gen_${index + 1}_${idBase}`,
    english,
    german,
    category: category || 'general',
    ...(pastTense ? { pastTense } : {})
  };
};

const generateUnitWords = (rawText: string): UnitWord[] => {
  const lines = rawText.split(/\r?\n/);
  const words = lines
    .map((line, index) => parseWordLine(line, index))
    .filter((item): item is UnitWord => Boolean(item));

  const seen = new Set<string>();
  return words.map((word, index) => {
    let id = word.id;
    while (seen.has(id)) {
      id = `${word.id}_${index + 1}`;
    }

    seen.add(id);
    return {
      ...word,
      id
    };
  });
};

const readRequestBody = async (req: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const sendJson = (res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, code: number, payload: unknown): void => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const buildSuggestedName = (inputName?: string): string => {
  const candidate = inputName?.trim();
  if (candidate) {
    return candidate;
  }

  const date = new Date().toISOString().slice(0, 10);
  return `AI 单元 ${date}`;
};

const learningUnitApiPlugin = (): Plugin => {
  const handler = async (
    req: { method?: string; url?: string } & NodeJS.ReadableStream,
    res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void },
    next: () => void
  ) => {
    if (req.url !== '/api/units/generate') {
      next();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      const payload = JSON.parse(rawBody) as UnitGenerateRequest;
      const rawText = payload.rawWordListText?.trim() ?? '';

      if (!rawText) {
        sendJson(res, 400, { error: 'rawWordListText is required' });
        return;
      }

      const words = generateUnitWords(rawText);
      if (words.length === 0) {
        sendJson(res, 422, {
          error: 'No valid word rows found',
          hint: '每行至少包含 english -> german，或 english|german|category。'
        });
        return;
      }

      sendJson(res, 200, {
        suggestedUnitName: buildSuggestedName(payload.unitName),
        words
      });
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
    }
  };

  return {
    name: 'learning-unit-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
};

export default defineConfig({
  plugins: [react(), learningUnitApiPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true
  }
});
