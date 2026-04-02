import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { getCityById, getThemeFacts } from './src/data/germanCities';
import { buildPostcardPrompt } from './src/lib/postcardPrompt';
import type { CityTheme } from './src/types';

type UnitGenerateRequest = {
  unitName?: string;
  rawWordListText?: string;
};

type PostcardGenerateRequest = {
  cityId?: string;
  theme?: CityTheme;
  readingLevel?: string;
};

type UnitWord = {
  id: string;
  english: string;
  german: string;
  category: string;
  pastTense?: string;
};

type GeneratedPostcardPayload = {
  title: string;
  caption: string;
  germanText: string;
  englishText: string;
};

type OpenAISettings = {
  apiKey: string;
  textModel: string;
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

const extractJsonObject = (content: string): unknown => {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('AI 返回内容不是有效 JSON。');
    }

    return JSON.parse(trimmed.slice(start, end + 1));
  }
};

const isGeneratedPostcardPayload = (payload: unknown): payload is GeneratedPostcardPayload => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.caption === 'string' &&
    typeof candidate.germanText === 'string' &&
    typeof candidate.englishText === 'string'
  );
};

const generatePostcardFromOpenAI = async (
  request: Required<PostcardGenerateRequest>,
  settings: OpenAISettings
): Promise<GeneratedPostcardPayload> => {
  const city = getCityById(request.cityId);
  if (!city) {
    throw new Error('未找到对应城市。');
  }

  const themeFacts = getThemeFacts(city, request.theme);
  if (!themeFacts.available) {
    throw new Error(themeFacts.unavailableReason ?? '该主题暂未开放。');
  }

  const apiKey = settings.apiKey;
  if (!apiKey) {
    throw new Error('AI 服务未配置 OPENAI_API_KEY。');
  }

  const model = settings.textModel;
  const prompt = buildPostcardPrompt({
    city,
    theme: request.theme,
    readingLevel: request.readingLevel
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        response_format: {
          type: 'json_object'
        },
        messages: [
          {
            role: 'system',
            content:
              'You create beginner-friendly German postcard readings and must return strict JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`OpenAI 请求失败：HTTP ${response.status} ${raw.slice(0, 160)}`.trim());
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenAI 返回内容为空。');
    }

    const parsed = extractJsonObject(content);
    if (!isGeneratedPostcardPayload(parsed)) {
      throw new Error('AI 返回 JSON 缺少必要字段。');
    }

    return {
      title: parsed.title.trim(),
      caption: parsed.caption.trim(),
      germanText: parsed.germanText.trim(),
      englishText: parsed.englishText.trim()
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI 生成超时，请稍后重试。');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const learningUnitApiPlugin = (settings: OpenAISettings): Plugin => {
  const handler = async (
    req: { method?: string; url?: string } & NodeJS.ReadableStream,
    res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void },
    next: () => void
  ) => {
    const pathname = (req.url ?? '').split('?')[0] ?? '';
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const isUnitApi = normalizedPath === '/api/units/generate';
    const isPostcardApi = normalizedPath === '/api/postcards/generate';

    if (!isUnitApi && !isPostcardApi) {
      next();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      if (isUnitApi) {
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
        return;
      }

      const payload = JSON.parse(rawBody) as PostcardGenerateRequest;
      const cityId = payload.cityId?.trim();
      const theme = payload.theme;
      const readingLevel = payload.readingLevel?.trim() || 'A1-A2';

      if (!cityId || !theme) {
        sendJson(res, 400, { error: 'cityId and theme are required' });
        return;
      }

      const city = getCityById(cityId);
      if (!city) {
        sendJson(res, 404, { error: '未找到对应城市。' });
        return;
      }

      const themeFacts = getThemeFacts(city, theme);
      if (!themeFacts.available) {
        sendJson(res, 422, { error: themeFacts.unavailableReason ?? '该主题暂未开放。' });
        return;
      }

      const postcard = await generatePostcardFromOpenAI({
        cityId,
        theme,
        readingLevel
      }, settings);

      sendJson(res, 200, postcard);
    } catch (error) {
      sendJson(res, 400, {
        error: error instanceof Error ? error.message : 'Invalid JSON payload'
      });
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const settings: OpenAISettings = {
    apiKey: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
    textModel: env.OPENAI_TEXT_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini'
  };

  return {
    plugins: [react(), learningUnitApiPlugin(settings)],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      css: true
    }
  };
});
