import { create } from 'zustand';
import { GERMAN_CITIES, getCityById, getThemeFacts } from '../data/germanCities';
import { loadPostcardAlbum, loadPostcardSession, savePostcardAlbum, savePostcardSession } from '../lib/storage';
import type {
  CityTheme,
  ExploreSessionState,
  GeneratedPostcard,
  PostcardAlbumEntry,
  PostcardImageSource
} from '../types';

const MAX_ALBUM_SIZE = 60;

const buildPostcardId = () => `postcard_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const buildAlbumId = () => `album_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

interface ExploreState {
  isInitialized: boolean;
  cities: typeof GERMAN_CITIES;
  selectedCityId: string | null;
  selectedTheme: CityTheme | null;
  activePostcard: GeneratedPostcard | null;
  album: PostcardAlbumEntry[];
  isGenerating: boolean;
  error: string | null;
  showEnglish: boolean;
  initializeExplore: () => void;
  selectCity: (cityId: string) => void;
  selectTheme: (theme: CityTheme) => void;
  generatePostcard: (cityId?: string, theme?: CityTheme) => Promise<void>;
  toggleTranslationMode: () => void;
  savePostcardToAlbum: () => void;
  openAlbumEntry: (entryId: string) => void;
  clearError: () => void;
  resetExploreState: () => void;
}

type PostcardResponsePayload = {
  title?: unknown;
  caption?: unknown;
  germanText?: unknown;
  englishText?: unknown;
  imageUrl?: unknown;
  imageSource?: unknown;
  error?: unknown;
};

const isPostcardImageSource = (value: unknown): value is PostcardImageSource =>
  value === 'pexels-theme' || value === 'pexels-city' || value === 'static-fallback';

const baseSession = (): ExploreSessionState => ({
  selectedCityId: null,
  selectedTheme: null,
  activePostcard: null
});

const persistSession = (state: ExploreState | Pick<ExploreState, 'selectedCityId' | 'selectedTheme' | 'activePostcard'>) => {
  savePostcardSession({
    selectedCityId: state.selectedCityId,
    selectedTheme: state.selectedTheme,
    activePostcard: state.activePostcard
  });
};

const resettableState = () => ({
  isInitialized: false,
  cities: GERMAN_CITIES,
  selectedCityId: null,
  selectedTheme: null,
  activePostcard: null,
  album: [],
  isGenerating: false,
  error: null,
  showEnglish: false
});

const tryParseJson = (raw: string): PostcardResponsePayload | null => {
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as PostcardResponsePayload;
  } catch {
    return null;
  }
};

export const useExploreStore = create<ExploreState>((set, get) => ({
  ...resettableState(),

  initializeExplore: () => {
    const session = loadPostcardSession();
    const album = loadPostcardAlbum();
    const validCityId = session.selectedCityId && getCityById(session.selectedCityId) ? session.selectedCityId : null;
    const validTheme = validCityId && session.selectedTheme ? session.selectedTheme : null;
    const validPostcard =
      session.activePostcard && getCityById(session.activePostcard.cityId) ? session.activePostcard : null;

    set({
      isInitialized: true,
      cities: GERMAN_CITIES,
      selectedCityId: validCityId,
      selectedTheme: validTheme,
      activePostcard: validPostcard,
      album,
      error: null,
      isGenerating: false,
      showEnglish: false
    });
  },

  selectCity: (cityId) => {
    const nextState = {
      selectedCityId: cityId,
      selectedTheme: null,
      activePostcard: null,
      error: null,
      showEnglish: false
    };

    set(nextState);
    persistSession({ ...get(), ...nextState });
  },

  selectTheme: (theme) => {
    const selectedCityId = get().selectedCityId;
    if (!selectedCityId) {
      set({ error: '请先在地图上选择城市。' });
      return;
    }

    const city = getCityById(selectedCityId);
    if (!city) {
      set({ error: '当前城市不存在，请重新选择。' });
      return;
    }

    const themeFacts = getThemeFacts(city, theme);
    if (!themeFacts.available) {
      set({ error: themeFacts.unavailableReason ?? '该主题暂未开放。' });
      return;
    }

    const nextState = {
      selectedTheme: theme,
      error: null,
      showEnglish: false
    };

    set(nextState);
    persistSession({ ...get(), ...nextState });
  },

  generatePostcard: async (cityId, theme) => {
    const nextCityId = cityId ?? get().selectedCityId;
    const nextTheme = theme ?? get().selectedTheme;

    if (!nextCityId) {
      set({ error: '请先选择一座城市。' });
      return;
    }

    if (!nextTheme) {
      set({ error: '请先选择一个主题。' });
      return;
    }

    const city = getCityById(nextCityId);
    if (!city) {
      set({ error: '未找到对应城市。' });
      return;
    }

    const themeFacts = getThemeFacts(city, nextTheme);
    if (!themeFacts.available) {
      set({ error: themeFacts.unavailableReason ?? '该主题暂未开放。' });
      return;
    }

    set({
      selectedCityId: nextCityId,
      selectedTheme: nextTheme,
      isGenerating: true,
      error: null,
      showEnglish: false
    });

    try {
      const response = await fetch('/api/postcards/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cityId: nextCityId,
          theme: nextTheme,
          readingLevel: 'A1-A2'
        })
      });

      const rawResponse = await response.text();
      const payload = tryParseJson(rawResponse);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            '未命中明信片 API。若为线上环境，请确认 Vercel 已部署 `api/postcards/generate`；若为本地环境，请通过 Vite 地址访问（如 http://localhost:5173）。'
          );
        }

        throw new Error(
          payload && typeof payload.error === 'string'
            ? payload.error
            : `AI 服务异常：HTTP ${response.status}`
        );
      }

      if (!payload) {
        throw new Error('AI 服务返回空响应，请稍后重试。');
      }

      if (
        typeof payload.title !== 'string' ||
        typeof payload.caption !== 'string' ||
        typeof payload.germanText !== 'string' ||
        typeof payload.englishText !== 'string'
      ) {
        throw new Error('AI 返回数据结构不完整。');
      }

      const postcard: GeneratedPostcard = {
        id: buildPostcardId(),
        cityId: nextCityId,
        theme: nextTheme,
        title: payload.title.trim(),
        caption: payload.caption.trim(),
        germanText: payload.germanText.trim(),
        englishText: payload.englishText.trim(),
        imageUrl: typeof payload.imageUrl === 'string' && payload.imageUrl.trim() ? payload.imageUrl.trim() : city.imageUrl,
        ...(isPostcardImageSource(payload.imageSource) ? { imageSource: payload.imageSource } : {}),
        createdAt: new Date().toISOString(),
        source: 'ai'
      };

      set({
        activePostcard: postcard,
        isGenerating: false,
        error: null,
        showEnglish: false
      });
      persistSession({ ...get(), activePostcard: postcard, selectedCityId: nextCityId, selectedTheme: nextTheme });
    } catch (error) {
      set({
        activePostcard: null,
        isGenerating: false,
        error: error instanceof Error ? error.message : '明信片生成失败，请稍后再试。',
        showEnglish: false
      });
      persistSession({ ...get(), activePostcard: null, selectedCityId: nextCityId, selectedTheme: nextTheme });
    }
  },

  toggleTranslationMode: () => {
    set((state) => ({ showEnglish: !state.showEnglish }));
  },

  savePostcardToAlbum: () => {
    const { activePostcard, album } = get();
    if (!activePostcard) {
      return;
    }

    const exists = album.some((entry) => entry.postcard.id === activePostcard.id);
    if (exists) {
      return;
    }

    const nextAlbum = [
      {
        id: buildAlbumId(),
        savedAt: new Date().toISOString(),
        postcard: activePostcard
      },
      ...album
    ].slice(0, MAX_ALBUM_SIZE);

    set({ album: nextAlbum });
    savePostcardAlbum(nextAlbum);
  },

  openAlbumEntry: (entryId) => {
    const entry = get().album.find((albumEntry) => albumEntry.id === entryId);
    if (!entry) {
      return;
    }

    set({
      selectedCityId: entry.postcard.cityId,
      selectedTheme: entry.postcard.theme,
      activePostcard: entry.postcard,
      error: null,
      showEnglish: false
    });
    persistSession({
      ...get(),
      selectedCityId: entry.postcard.cityId,
      selectedTheme: entry.postcard.theme,
      activePostcard: entry.postcard
    });
  },

  clearError: () => {
    set({ error: null });
  },

  resetExploreState: () => {
    savePostcardAlbum([]);
    savePostcardSession(baseSession());
    set(resettableState());
  }
}));
