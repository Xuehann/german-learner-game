import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CityTheme } from '../types';
import { __test_resetPostcardImageCache, resolvePostcardImage } from './postcardImageResolver';

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });

const createOptions = (
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
  overrides?: Partial<{
    cityId: string;
    cityNameEn: string;
    theme: CityTheme;
    staticImageUrl: string;
    themeKeywords: string[];
    pexelsApiKey: string;
    cacheTtlMs: number;
    timeoutMs: number;
    retryCount: number;
  }>
) => ({
  cityId: 'berlin',
  cityNameEn: 'Berlin',
  theme: 'architecture' as CityTheme,
  staticImageUrl: '/images/cities/berlin.svg',
  themeKeywords: ['Brandenburger Tor', 'Reichstag'],
  pexelsApiKey: 'pexels_key',
  cacheTtlMs: 60 * 60 * 1000,
  timeoutMs: 2000,
  retryCount: 1,
  fetchImpl,
  ...overrides
});

describe('resolvePostcardImage', () => {
  beforeEach(() => {
    __test_resetPostcardImageCache();
  });

  it('returns theme image when Pexels theme query has results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        photos: [{ src: { landscape: 'https://images.pexels.com/theme-berlin.jpg' } }]
      })
    );

    const result = await resolvePostcardImage(createOptions(fetchMock));

    expect(result.imageSource).toBe('pexels-theme');
    expect(result.imageUrl).toBe('https://images.pexels.com/theme-berlin.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = decodeURIComponent(String(fetchMock.mock.calls[0]?.[0] ?? ''));
    expect(requestUrl).toContain('Berlin Germany');
    expect(requestUrl).toContain('architecture');
  });

  it('falls back to city query when theme query has no results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ photos: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          photos: [{ src: { landscape: 'https://images.pexels.com/city-berlin.jpg' } }]
        })
      );

    const result = await resolvePostcardImage(createOptions(fetchMock));

    expect(result.imageSource).toBe('pexels-city');
    expect(result.imageUrl).toBe('https://images.pexels.com/city-berlin.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to static image when both Pexels queries have no results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ photos: [] }))
      .mockResolvedValueOnce(jsonResponse({ photos: [] }));

    const result = await resolvePostcardImage(createOptions(fetchMock));

    expect(result.imageSource).toBe('static-fallback');
    expect(result.imageUrl).toBe('/images/cities/berlin.svg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to static image when PEXELS_API_KEY is missing', async () => {
    const fetchMock = vi.fn();

    const result = await resolvePostcardImage(
      createOptions(fetchMock as unknown as (input: string, init?: RequestInit) => Promise<Response>, {
        pexelsApiKey: ''
      })
    );

    expect(result.imageSource).toBe('static-fallback');
    expect(result.imageUrl).toBe('/images/cities/berlin.svg');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('retries once on failed theme request and then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(
        jsonResponse({
          photos: [{ src: { landscape: 'https://images.pexels.com/retry-success.jpg' } }]
        })
      );

    const result = await resolvePostcardImage(createOptions(fetchMock));

    expect(result.imageSource).toBe('pexels-theme');
    expect(result.imageUrl).toBe('https://images.pexels.com/retry-success.jpg');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses memory cache for the same city and theme', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        photos: [{ src: { landscape: 'https://images.pexels.com/cached.jpg' } }]
      })
    );

    const options = createOptions(fetchMock);
    const first = await resolvePostcardImage(options);
    const second = await resolvePostcardImage(options);

    expect(first.imageUrl).toBe('https://images.pexels.com/cached.jpg');
    expect(second.imageUrl).toBe('https://images.pexels.com/cached.jpg');
    expect(second.imageSource).toBe('pexels-theme');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
