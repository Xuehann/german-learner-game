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
  exampleDe: string;
  exampleZh: string;
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

const isGeneratedOrderExamplePayload = (
  payload: unknown
): payload is { exampleDe: string; exampleZh: string } => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.exampleDe === 'string' &&
    candidate.exampleDe.trim().length > 0 &&
    typeof candidate.exampleZh === 'string' &&
    candidate.exampleZh.trim().length > 0
  );
};

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

type BilingualExample = {
  de: string;
  zh: string;
};

type ExampleTemplate = {
  de: string;
  zh: string;
};

const VERB_TEMPLATES: ExampleTemplate[] = [
  {
    de: 'Im Seminar erklärte der Dozent ausführlich, wie man {word} im Alltag präzise verwendet.',
    zh: '在研讨课上，讲师详细解释了如何在日常中准确使用“{word}”。'
  },
  {
    de: 'Trotz des Zeitdrucks versucht sie, {word} in unterschiedlichen Situationen bewusst anzuwenden.',
    zh: '尽管时间紧张，她仍尝试在不同场景中有意识地运用“{word}”。'
  },
  {
    de: 'Bei der Präsentation zeigte er, warum {word} für professionelle Kommunikation besonders wichtig ist.',
    zh: '在展示中，他说明了为什么“{word}”对专业沟通尤其重要。'
  },
  {
    de: 'Im Unterricht übten wir, {word} mit passenden Ergänzungen klar und flüssig zu formulieren.',
    zh: '课堂上我们练习了如何搭配合适成分，把“{word}”表达得清晰流畅。'
  },
  {
    de: 'Um Missverständnisse zu vermeiden, lernte sie, {word} im Gespräch genauer zu kontextualisieren.',
    zh: '为了避免误解，她学习了在对话中更准确地给“{word}”加上语境。'
  },
  {
    de: 'Er bemerkte schnell, dass man {word} je nach Situation stilistisch unterschiedlich einsetzen kann.',
    zh: '他很快注意到，“{word}”会因场景不同而有不同的表达风格。'
  }
];

const NOUN_TEMPLATES: ExampleTemplate[] = [
  {
    de: 'Sie ist {word} von zwei Kindern und spricht mit ihnen jeden Abend über die Schule.',
    zh: '她是两个孩子的{word}，每天晚上都会和他们聊学校里的事。'
  },
  {
    de: 'In seinem Vortrag betonte er, dass {word} für die langfristige Entwicklung der Stadt entscheidend ist.',
    zh: '在他的演讲中，他强调“{word}”对城市的长期发展至关重要。'
  },
  {
    de: 'Während der Diskussion wurde deutlich, dass {word} im Alltag oft unterschätzt wird.',
    zh: '在讨论中，大家逐渐意识到“{word}”在日常生活中常被低估。'
  },
  {
    de: 'Aus beruflicher Sicht spielt {word} eine zentrale Rolle bei wichtigen Entscheidungen.',
    zh: '从职业角度看，“{word}”在关键决策中扮演核心角色。'
  },
  {
    de: 'Nach mehreren Gesprächen verstand sie, warum {word} für viele Familien so bedeutend ist.',
    zh: '经过多次交流，她明白了为什么“{word}”对许多家庭如此重要。'
  },
  {
    de: 'Im Bericht wurde erklärt, wie sich {word} in den letzten Jahren deutlich verändert hat.',
    zh: '报告中解释了“{word}”在过去几年里发生的明显变化。'
  }
];

const ABSTRACT_TEMPLATES: ExampleTemplate[] = [
  {
    de: 'Sie vertritt die Meinung, dass {word} nur mit Geduld und Respekt nachhaltig erreicht werden kann.',
    zh: '她认为，只有以耐心和尊重为基础，{word}才能被长期实现。'
  },
  {
    de: 'Seine Erfahrung zeigt, dass {word} durch kleine Gewohnheiten auf lange Sicht gestärkt wird.',
    zh: '他的经验表明，{word}会通过小习惯在长期中被强化。'
  },
  {
    de: 'In der Debatte wurde klar, dass {word} nicht nur theoretisch, sondern auch praktisch relevant ist.',
    zh: '在辩论中，人们意识到“{word}”不仅是理论概念，也有实际意义。'
  },
  {
    de: 'Aus ihrer Perspektive entsteht {word} erst dann, wenn Vertrauen und Verantwortung zusammenkommen.',
    zh: '在她看来，只有当信任与责任结合时，“{word}”才会真正形成。'
  },
  {
    de: 'Der Artikel beschreibt, warum {word} in internationalen Teams besonders sorgfältig aufgebaut werden muss.',
    zh: '这篇文章说明了为什么在国际化团队中，“{word}”需要被特别谨慎地建立。'
  },
  {
    de: 'Für ihn bedeutet {word}, auch unter Druck ruhig und nachvollziehbar zu handeln.',
    zh: '对他来说，“{word}”意味着即使在压力下也要冷静并清晰行事。'
  }
];

const REVIEW_TEMPLATES: ExampleTemplate[] = [
  {
    de: 'Zur Wiederholung formulierte sie einen längeren Satz, damit {word} im Gedächtnis bleibt.',
    zh: '为了复习，她造了一个更长的句子，让“{word}”留在记忆里。'
  },
  {
    de: 'Beim erneuten Üben merkte er, dass {word} mit Kontext deutlich leichter zu behalten ist.',
    zh: '在再次练习时，他发现“{word}”放入语境后会更容易记住。'
  },
  {
    de: 'Durch regelmäßige Wiederholung konnte sie {word} im Gespräch viel sicherer einsetzen.',
    zh: '通过规律复习，她在对话中使用“{word}”时明显更自信了。'
  },
  {
    de: 'Um die Form zu festigen, schrieb er jeden Tag einen neuen Beispielsatz mit {word}.',
    zh: '为了巩固这个形式，他每天都用“{word}”写一个新例句。'
  },
  {
    de: 'Nach einigen Wiederholungen verstand sie endlich, wie {word} natürlich im Satz klingt.',
    zh: '经过几轮复习后，她终于理解了“{word}”在句子里自然的用法。'
  },
  {
    de: 'Mit gezielten Übungen lernte er, {word} auch unter Zeitdruck korrekt zu verwenden.',
    zh: '通过有针对性的练习，他学会了在时间压力下也能正确使用“{word}”。'
  }
];

const GENERAL_TEMPLATES: ExampleTemplate[] = [
  {
    de: 'Im Alltag stellte sie fest, dass {word} in vielen Situationen präziser wirkt als erwartet.',
    zh: '在日常中她发现，“{word}”在很多场景下比预想更准确。'
  },
  {
    de: 'Er erklärte seinem Team, wie {word} die Kommunikation zwischen den Abteilungen verbessern kann.',
    zh: '他向团队解释了“{word}”如何改善部门之间的沟通。'
  },
  {
    de: 'Nach mehreren Beispielen wurde deutlich, dass {word} in formellen Kontexten besonders nützlich ist.',
    zh: '经过多个例子后，大家发现“{word}”在正式语境中尤其有用。'
  },
  {
    de: 'Sie merkte schnell, dass man mit {word} komplexe Inhalte klarer strukturieren kann.',
    zh: '她很快意识到，用“{word}”可以更清晰地组织复杂内容。'
  },
  {
    de: 'Im Gespräch mit Kunden zeigte sich, dass {word} einen professionellen Eindruck vermittelt.',
    zh: '在与客户交流时，“{word}”能传达更专业的印象。'
  },
  {
    de: 'Seine Lehrerin empfahl, {word} in längeren Sätzen zu üben, um sicherer zu werden.',
    zh: '老师建议他在更长的句子里练习“{word}”，以提升稳定性。'
  }
];

const pickExampleTemplatePool = (request: {
  orderType: 'translation' | 'review' | 'combo';
  correctAnswer: string;
  words: Array<{ german: string; english: string; category: string }>;
}): ExampleTemplate[] => {
  if (request.orderType === 'review') {
    return REVIEW_TEMPLATES;
  }

  const first = request.words[0];
  const category = (first?.category ?? '').toLowerCase();

  if (category.includes('verb') || first?.category.includes('动词')) {
    return VERB_TEMPLATES;
  }

  if (
    category.includes('abstract') ||
    category.includes('emotion') ||
    category.includes('feeling') ||
    category.includes('opinion') ||
    category.includes('concept')
  ) {
    return ABSTRACT_TEMPLATES;
  }

  if (
    category.includes('family') ||
    category.includes('people') ||
    category.includes('food') ||
    category.includes('daily') ||
    category.includes('place') ||
    category.includes('home') ||
    category.includes('travel') ||
    category.includes('animal') ||
    category.includes('time')
  ) {
    return NOUN_TEMPLATES;
  }

  return GENERAL_TEMPLATES;
};

const fillTemplateWord = (template: ExampleTemplate, word: string): BilingualExample => ({
  de: template.de.replaceAll('{word}', word),
  zh: template.zh.replaceAll('{word}', word)
});

const buildFallbackOrderExample = (request: {
  orderType: 'translation' | 'review' | 'combo';
  correctAnswer: string;
  words: Array<{ german: string; english: string; category: string }>;
}): BilingualExample => {
  const first = request.words[0];
  const base = first?.german.trim() || request.correctAnswer.trim();
  const pool = pickExampleTemplatePool(request);
  const chosen = pool[Math.floor(Math.random() * pool.length)] ?? GENERAL_TEMPLATES[0]!;
  return fillTemplateWord(chosen, base);
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
): Promise<BilingualExample> => {
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
              'You are a German tutor. Return strict JSON only with keys "exampleDe" and "exampleZh". exampleDe must be one natural B1-B2 level German sentence with 9-22 words. exampleZh must be a faithful Chinese translation.'
          },
          {
            role: 'user',
            content: `Order type: ${request.orderType}. Correct answer: ${request.correctAnswer}. Key words: ${wordHints}. Constraints: include the correct answer exactly once in the German sentence; avoid overly short A1 phrasing; produce one sentence only.`
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
      throw new Error('AI 例句返回 JSON 缺少 exampleDe/exampleZh 字段。');
    }

    const de = parsed.exampleDe.trim();
    const zh = parsed.exampleZh.trim();

    if (countWords(de) < 8) {
      throw new Error('AI 例句过短，未达到 B1-B2 复杂度。');
    }

    return { de, zh };
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
          exampleDe: example.de,
          exampleZh: example.zh,
          source: 'ai'
        } satisfies GeneratedOrderExampleApiResponse
      };
    } catch {
      return {
        statusCode: 200,
        body: {
          exampleDe: fallback.de,
          exampleZh: fallback.zh,
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
