import type { CityTheme, PostcardImageSource } from '../types';

export interface ResolvedPostcardImage {
  imageUrl: string;
  imageSource: PostcardImageSource;
}

type CachedImageRecord = {
  imageUrl: string;
  imageSource: PostcardImageSource;
  expiresAt: number;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface ResolvePostcardImageOptions {
  cityId: string;
  cityNameEn: string;
  theme: CityTheme;
  staticImageUrl: string;
  themeKeywords: string[];
  pexelsApiKey?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  retryCount?: number;
  cacheTtlMs?: number;
}

type PexelsPhoto = {
  src?: {
    landscape?: string;
    large2x?: string;
    large?: string;
    medium?: string;
    original?: string;
  };
};

type PexelsSearchResponse = {
  photos?: PexelsPhoto[];
};

const CITY_IMAGE_CACHE = new Map<string, CachedImageRecord>();

const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_RETRY_COUNT = 1;

const THEME_HINTS: Record<CityTheme, string> = {
  culture: 'culture museum local life',
  architecture: 'architecture historic building skyline',
  landmarks: 'landmarks sightseeing cityscape travel',
  food: 'local food traditional dish street food',
  festivals: 'festival parade market celebration'
};

const cleanKeyword = (value: string): string =>
  value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildThemeQuery = (cityNameEn: string, theme: CityTheme, themeKeywords: string[]): string => {
  const keywordPart = themeKeywords
    .map(cleanKeyword)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');

  const query = `${cityNameEn} Germany ${THEME_HINTS[theme]} ${keywordPart}`.trim();
  return query.replace(/\s+/g, ' ');
};

const buildCityQuery = (cityNameEn: string): string =>
  `${cityNameEn} Germany cityscape travel`;

const getCacheKey = (cityId: string, theme: CityTheme): string =>
  `${cityId}:${theme}`;

const readFromCache = (cacheKey: string): ResolvedPostcardImage | null => {
  const cached = CITY_IMAGE_CACHE.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    CITY_IMAGE_CACHE.delete(cacheKey);
    return null;
  }

  return {
    imageUrl: cached.imageUrl,
    imageSource: cached.imageSource
  };
};

const writeToCache = (cacheKey: string, image: ResolvedPostcardImage, ttlMs: number): void => {
  CITY_IMAGE_CACHE.set(cacheKey, {
    imageUrl: image.imageUrl,
    imageSource: image.imageSource,
    expiresAt: Date.now() + ttlMs
  });
};

const pickPhotoUrl = (photo?: PexelsPhoto): string | null => {
  const candidate =
    photo?.src?.landscape ??
    photo?.src?.large2x ??
    photo?.src?.large ??
    photo?.src?.medium ??
    photo?.src?.original ??
    '';

  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const searchPexelsOnce = async (
  query: string,
  apiKey: string,
  fetchImpl: FetchLike,
  timeoutMs: number
): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
      method: 'GET',
      headers: {
        Authorization: apiKey
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Pexels search failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as PexelsSearchResponse;
    return pickPhotoUrl(payload.photos?.[0]);
  } finally {
    clearTimeout(timeout);
  }
};

const searchPexelsWithRetry = async (
  query: string,
  apiKey: string,
  fetchImpl: FetchLike,
  timeoutMs: number,
  retryCount: number
): Promise<string | null> => {
  let attempts = 0;

  while (attempts <= retryCount) {
    try {
      return await searchPexelsOnce(query, apiKey, fetchImpl, timeoutMs);
    } catch {
      attempts += 1;
      if (attempts > retryCount) {
        return null;
      }
    }
  }

  return null;
};

const staticFallback = (staticImageUrl: string): ResolvedPostcardImage => ({
  imageUrl: staticImageUrl,
  imageSource: 'static-fallback'
});

export const resolvePostcardImage = async (options: ResolvePostcardImageOptions): Promise<ResolvedPostcardImage> => {
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryCount = options.retryCount ?? DEFAULT_RETRY_COUNT;
  const apiKey = options.pexelsApiKey?.trim() ?? '';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (!apiKey) {
    return staticFallback(options.staticImageUrl);
  }

  const cacheKey = getCacheKey(options.cityId, options.theme);
  const cached = readFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const themeQuery = buildThemeQuery(options.cityNameEn, options.theme, options.themeKeywords);
  const themeImageUrl = await searchPexelsWithRetry(themeQuery, apiKey, fetchImpl, timeoutMs, retryCount);

  if (themeImageUrl) {
    const result: ResolvedPostcardImage = {
      imageUrl: themeImageUrl,
      imageSource: 'pexels-theme'
    };
    writeToCache(cacheKey, result, cacheTtlMs);
    return result;
  }

  const cityQuery = buildCityQuery(options.cityNameEn);
  const cityImageUrl = await searchPexelsWithRetry(cityQuery, apiKey, fetchImpl, timeoutMs, retryCount);

  if (cityImageUrl) {
    const result: ResolvedPostcardImage = {
      imageUrl: cityImageUrl,
      imageSource: 'pexels-city'
    };
    writeToCache(cacheKey, result, cacheTtlMs);
    return result;
  }

  const fallback = staticFallback(options.staticImageUrl);
  writeToCache(cacheKey, fallback, cacheTtlMs);
  return fallback;
};

export const __test_resetPostcardImageCache = (): void => {
  CITY_IMAGE_CACHE.clear();
};
