import { getCityById, getThemeFacts } from '../data/germanCities.js';
import { resolvePostcardImage } from '../lib/postcardImageResolver.js';
import { buildPostcardPrompt } from '../lib/postcardPrompt.js';
import type { CityTheme, PostcardImageSource } from '../types.js';

export type UnitGenerateRequest = {
  unitName?: string;
  rawWordListText?: string;
};

export type PostcardGenerateRequest = {
  cityId?: string;
  theme?: CityTheme;
  readingLevel?: string;
};

export type OrderExampleRequest = {
  orderType?: 'translation' | 'review' | 'combo';
  correctAnswer?: string;
  words?: Array<{
    german?: string;
    english?: string;
    category?: string;
  }>;
};

export type UnitWord = {
  id: string;
  english: string;
  german: string;
  category: string;
  pastTense?: string;
};

export type GeneratedPostcardPayload = {
  title: string;
  caption: string;
  germanText: string;
  englishText: string;
};

export type GeneratedPostcardApiResponse = GeneratedPostcardPayload & {
  imageUrl: string;
  imageSource: PostcardImageSource;
};

export type GeneratedOrderExampleApiResponse = {
  example: string;
  source: 'ai' | 'fallback';
};

export type OpenAISettings = {
  apiKey: string;
  textModel: string;
  pexelsApiKey: string;
};

export type ApiHandlerResponse = {
  statusCode: number;
  body: unknown;
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

const isGeneratedOrderExamplePayload = (payload: unknown): payload is { example: string } => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return typeof candidate.example === 'string' && candidate.example.trim().length > 0;
};

const buildFallbackOrderExample = (request: {
  orderType: 'translation' | 'review' | 'combo';
  correctAnswer: string;
  words: Array<{ german: string; english: string; category: string }>;
}): string => {
  const first = request.words[0];
  const base = first?.german.trim() || request.correctAnswer.trim();
  const category = (first?.category ?? '').toLowerCase();

  if (category.includes('verb') || first?.category.includes('动词')) {
    return `Ich übe heute das Verb ${base}.`;
  }

  if (request.orderType === 'review') {
    return `Zur Wiederholung merke ich mir: ${base}.`;
  }

  return `Heute bestelle ich ${base}.`;
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
        model: settings.textModel,
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

const generateOrderExampleFromOpenAI = async (
  request: {
    orderType: 'translation' | 'review' | 'combo';
    correctAnswer: string;
    words: Array<{ german: string; english: string; category: string }>;
  },
  settings: OpenAISettings
): Promise<string> => {
  const apiKey = settings.apiKey;
  if (!apiKey) {
    throw new Error('AI 服务未配置 OPENAI_API_KEY。');
  }

  const wordHints = request.words
    .slice(0, 3)
    .map((word) => `${word.german} (${word.english}; ${word.category || 'general'})`)
    .join('; ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: settings.textModel,
        temperature: 0.7,
        response_format: {
          type: 'json_object'
        },
        messages: [
          {
            role: 'system',
            content:
              'You are a German tutor. Return JSON only with key "example". Provide one short natural German sentence (A1-A2).'
          },
          {
            role: 'user',
            content: `Order type: ${request.orderType}. Correct answer: ${request.correctAnswer}. Key words: ${wordHints}.`
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
    if (!isGeneratedOrderExamplePayload(parsed)) {
      throw new Error('AI 例句返回 JSON 缺少 example 字段。');
    }

    return parsed.example.trim();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI 例句生成超时。');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const normalizeRequestBody = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }

  if (value === null || typeof value === 'undefined') {
    return '';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return String(value);
};

export const buildOpenAISettings = (
  env: Record<string, string | undefined>
): OpenAISettings => ({
  apiKey: env.OPENAI_API_KEY || '',
  textModel: env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
  pexelsApiKey: env.PEXELS_API_KEY || ''
});

export const handleUnitGenerateRequest = async (
  rawBody: string
): Promise<ApiHandlerResponse> => {
  try {
    const payload = JSON.parse(rawBody) as UnitGenerateRequest;
    const rawText = payload.rawWordListText?.trim() ?? '';

    if (!rawText) {
      return {
        statusCode: 400,
        body: { error: 'rawWordListText is required' }
      };
    }

    const words = generateUnitWords(rawText);
    if (words.length === 0) {
      return {
        statusCode: 422,
        body: {
          error: 'No valid word rows found',
          hint: '每行至少包含 english -> german，或 english|german|category。'
        }
      };
    }

    return {
      statusCode: 200,
      body: {
        suggestedUnitName: buildSuggestedName(payload.unitName),
        words
      }
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        error: error instanceof Error ? error.message : 'Invalid JSON payload'
      }
    };
  }
};

export const handleOrderExampleRequest = async (
  rawBody: string,
  settings: OpenAISettings
): Promise<ApiHandlerResponse> => {
  try {
    const payload = JSON.parse(rawBody) as OrderExampleRequest;
    const correctAnswer = payload.correctAnswer?.trim() ?? '';

    if (!correctAnswer) {
      return {
        statusCode: 400,
        body: { error: 'correctAnswer is required' }
      };
    }

    const orderType: 'translation' | 'review' | 'combo' =
      payload.orderType === 'review' ? 'review' : payload.orderType === 'combo' ? 'combo' : 'translation';
    const words = Array.isArray(payload.words)
      ? payload.words
          .map((word) => ({
            german: word.german?.trim() ?? '',
            english: word.english?.trim() ?? '',
            category: word.category?.trim() ?? 'general'
          }))
          .filter((word) => word.german.length > 0 || word.english.length > 0)
      : [];

    const normalized = {
      orderType,
      correctAnswer,
      words: words.length > 0 ? words : [{ german: correctAnswer, english: '', category: 'general' }]
    };

    const fallback = buildFallbackOrderExample(normalized);

    try {
      const example = await generateOrderExampleFromOpenAI(normalized, settings);
      return {
        statusCode: 200,
        body: {
          example,
          source: 'ai'
        } satisfies GeneratedOrderExampleApiResponse
      };
    } catch {
      return {
        statusCode: 200,
        body: {
          example: fallback,
          source: 'fallback'
        } satisfies GeneratedOrderExampleApiResponse
      };
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        error: error instanceof Error ? error.message : 'Invalid JSON payload'
      }
    };
  }
};

export const handlePostcardGenerateRequest = async (
  rawBody: string,
  settings: OpenAISettings
): Promise<ApiHandlerResponse> => {
  try {
    const payload = JSON.parse(rawBody) as PostcardGenerateRequest;
    const cityId = payload.cityId?.trim();
    const theme = payload.theme;
    const readingLevel = payload.readingLevel?.trim() || 'A1-A2';

    if (!cityId || !theme) {
      return {
        statusCode: 400,
        body: { error: 'cityId and theme are required' }
      };
    }

    const city = getCityById(cityId);
    if (!city) {
      return {
        statusCode: 404,
        body: { error: '未找到对应城市。' }
      };
    }

    const themeFacts = getThemeFacts(city, theme);
    if (!themeFacts.available) {
      return {
        statusCode: 422,
        body: { error: themeFacts.unavailableReason ?? '该主题暂未开放。' }
      };
    }

    const postcard = await generatePostcardFromOpenAI(
      {
        cityId,
        theme,
        readingLevel
      },
      settings
    );
    const image = await resolvePostcardImage({
      cityId,
      cityNameEn: city.nameEn,
      theme,
      staticImageUrl: city.imageUrl,
      themeKeywords: themeFacts.keywords,
      pexelsApiKey: settings.pexelsApiKey
    });

    const responsePayload: GeneratedPostcardApiResponse = {
      ...postcard,
      imageUrl: image.imageUrl,
      imageSource: image.imageSource
    };

    return {
      statusCode: 200,
      body: responsePayload
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        error: error instanceof Error ? error.message : 'Invalid JSON payload'
      }
    };
  }
};
