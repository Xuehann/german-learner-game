import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CITY_THEME_META, getCityById, getThemeFacts } from '../data/germanCities';
import { useExploreStore } from '../store/exploreStore';
import type { CityProfile, CityTheme } from '../types';

const CITY_THEMES = Object.keys(CITY_THEME_META) as CityTheme[];

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const getAvailableThemes = (city: CityProfile): CityTheme[] =>
  CITY_THEMES.filter((theme) => getThemeFacts(city, theme).available);

const pickRandomTheme = (themes: CityTheme[]): CityTheme => {
  const index = Math.floor(Math.random() * themes.length);
  return themes[index] ?? themes[0] ?? 'culture';
};

export function ExplorePage() {
  const {
    isInitialized,
    cities,
    selectedCityId,
    selectedTheme,
    activePostcard,
    album,
    isGenerating,
    error,
    showEnglish,
    initializeExplore,
    selectCity,
    selectTheme,
    generatePostcard,
    toggleTranslationMode,
    savePostcardToAlbum,
    openAlbumEntry,
    clearError
  } = useExploreStore();

  const [isPostcardModalOpen, setPostcardModalOpen] = useState(false);
  const [isAlbumModalOpen, setAlbumModalOpen] = useState(false);

  useEffect(() => {
    initializeExplore();
  }, [initializeExplore]);

  useEffect(() => {
    if (activePostcard) {
      setPostcardModalOpen(true);
    }
  }, [activePostcard]);

  const selectedCity = useMemo(() => {
    if (!selectedCityId) {
      return null;
    }

    return getCityById(selectedCityId) ?? null;
  }, [selectedCityId]);

  const activeParagraphs = useMemo(() => {
    if (!activePostcard) {
      return [];
    }

    return splitParagraphs(showEnglish ? activePostcard.englishText : activePostcard.germanText);
  }, [activePostcard, showEnglish]);

  const isSaved = activePostcard
    ? album.some((entry) => entry.postcard.id === activePostcard.id)
    : false;

  const triggerRandomThemeGeneration = async (city: CityProfile, avoidTheme?: CityTheme | null) => {
    const availableThemes = getAvailableThemes(city);
    if (availableThemes.length === 0) {
      return;
    }

    const pool =
      avoidTheme && availableThemes.length > 1
        ? availableThemes.filter((theme) => theme !== avoidTheme)
        : availableThemes;

    const randomTheme = pickRandomTheme(pool.length > 0 ? pool : availableThemes);
    selectTheme(randomTheme);
    await generatePostcard(city.id, randomTheme);
  };

  const handleCitySelect = async (cityId: string) => {
    const city = getCityById(cityId);
    if (!city) {
      return;
    }

    clearError();
    selectCity(cityId);
    await triggerRandomThemeGeneration(city, null);
  };

  const handleRegenerate = async () => {
    if (!selectedCity) {
      return;
    }

    await triggerRandomThemeGeneration(selectedCity, selectedTheme);
  };

  const handleOpenAlbumEntry = (entryId: string) => {
    openAlbumEntry(entryId);
    setAlbumModalOpen(false);
    setPostcardModalOpen(true);
  };

  if (!isInitialized) {
    return <div className="p-6 text-center text-butcher-deep">正在搭建德国旅行地图...</div>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1380px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[34px] border-[5px] border-[#2a4638] bg-[#f6edd9] shadow-[0_22px_70px_rgba(34,54,46,0.24)]">
        <header className="border-b-[5px] border-[#385647] bg-[linear-gradient(135deg,#193c31_0%,#275244_44%,#4e7a67_100%)] px-5 py-5 text-[#f8f3e2] sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#cce8d5]">Germany Travel Deck</p>
              <h1 className="mt-2 font-heading text-3xl sm:text-4xl">出门旅游</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#def0e2] sm:text-base">
                先选城市，再随机抽取主题生成明信片。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => setAlbumModalOpen(true)}
                className="rounded-full border-2 border-[#d8ecdd] bg-[#f6efdd] px-4 py-2 text-[#214238] shadow-[0_4px_0_#bad1c2]"
              >
                明信片收藏夹（{album.length}）
              </button>
              <Link
                to="/"
                className="rounded-full border-2 border-[#8cb09d] bg-[#24473a] px-4 py-2 text-[#f8f2e4] shadow-[0_4px_0_#173128]"
              >
                返回营业台
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-5 bg-[linear-gradient(180deg,#efe2c4_0%,#f8f3e8_100%)] p-4 sm:p-5 lg:grid-cols-[1.32fr_0.68fr]">
          <section className="rounded-[30px] border-[4px] border-[#28483a] bg-[#d3edf2] p-3 shadow-[0_11px_0_#4b6f63]">
            <div className="rounded-[22px] border-[4px] border-[#35584a] bg-[linear-gradient(180deg,#d3efff_0%,#daf3ff_26%,#f8e6bc_100%)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-2xl text-[#17332b]">德国地图</h2>
                  <p className="text-sm text-[#28483e]">地图上的图标可点击，悬停可查看城市名。</p>
                </div>
                <span className="rounded-2xl border-2 border-[#567a6f] bg-[#f7f5eb] px-3 py-2 text-xs text-[#29443b]">
                  城市数: {cities.length}
                </span>
              </div>

              <div className="relative aspect-[11/8] overflow-hidden rounded-[24px] border-[4px] border-[#36584a] bg-[radial-gradient(circle_at_20%_15%,#f8ffff_0%,#daf4ff_24%,#9ed8ff_56%,#71bedf_100%)]">
                <svg
                  viewBox="0 0 520 640"
                  className="absolute left-[12%] top-[8%] h-[86%] w-[56%] drop-shadow-[14px_16px_0_rgba(47,76,59,0.33)]"
                  aria-hidden="true"
                >
                  <path
                    d="M245 19L283 35L323 31L349 49L372 92L405 106L416 140L401 163L430 193L421 232L444 263L424 291L436 340L410 368L415 412L378 440L360 485L335 510L294 520L271 610L229 615L207 573L169 548L155 504L117 481L96 434L101 390L77 353L80 317L48 285L54 243L89 211L95 172L128 150L151 106L198 88L210 48L245 19Z"
                    fill="url(#germanyLand)"
                    stroke="#4a6a58"
                    strokeWidth="8"
                  />
                  <path
                    d="M246 55L290 65L305 101L274 126L250 116L229 86L246 55Z"
                    fill="#bce1a6"
                    opacity="0.55"
                  />
                  <path
                    d="M180 210L250 236L237 308L164 302L142 250L180 210Z"
                    fill="#b6d89e"
                    opacity="0.45"
                  />
                  <path
                    d="M301 340L371 354L373 418L314 455L271 427L273 365L301 340Z"
                    fill="#afcf8f"
                    opacity="0.5"
                  />
                  <defs>
                    <linearGradient id="germanyLand" x1="246" y1="19" x2="246" y2="620" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#99d473" />
                      <stop offset="1" stopColor="#6aa757" />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="pointer-events-none absolute left-[12%] top-[8%] h-[86%] w-[56%]">
                  {cities.map((city) => {
                    const active = city.id === selectedCityId;
                    return (
                      <button
                        key={city.id}
                        type="button"
                        aria-label={`选择城市 ${city.nameEn}`}
                        onClick={() => void handleCitySelect(city.id)}
                        className={`pointer-events-auto group absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] p-2 text-xl shadow-[0_7px_0_rgba(49,60,53,0.28)] transition hover:-translate-y-[58%] ${
                          active
                            ? 'border-[#fff1cc] bg-[#24493b] text-[#fff6df]'
                            : 'border-[#3f6553] bg-[#fff4df] text-[#20372d]'
                        }`}
                        style={{ left: city.mapPosition.left, top: city.mapPosition.top }}
                      >
                        <span aria-hidden="true">📍</span>
                        <span className="pointer-events-none absolute left-1/2 top-[115%] z-20 hidden min-w-max -translate-x-1/2 rounded-md border border-[#466a57] bg-[#233f35] px-2 py-1 text-xs text-[#f7f0df] group-hover:block group-focus-visible:block">
                          {city.nameDe} / {city.nameEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border-[4px] border-[#71512e] bg-[linear-gradient(180deg,#f9efdb_0%,#f2ddba_100%)] p-4 shadow-[0_10px_0_#8d6a47]">
            {selectedCity ? (
              <>
                <p className="text-xs uppercase tracking-[0.28em] text-[#8f6638]">Selected City</p>
                <h2 className="mt-2 font-heading text-3xl text-[#3b2414]">{selectedCity.nameDe}</h2>
                <p className="text-sm text-[#68492d]">
                  {selectedCity.nameEn} · {selectedCity.countryRegion}
                </p>
                <img
                  src={selectedCity.imageUrl}
                  alt={`${selectedCity.nameDe} city preview`}
                  className="mt-3 h-44 w-full rounded-[20px] border-[4px] border-[#865f3a] object-cover shadow-[0_8px_0_#b99067]"
                />
                <p className="mt-3 rounded-[16px] border border-[#d2b084] bg-[#fff6e8] px-3 py-3 text-sm leading-6 text-[#4c311e]">
                  {selectedCity.summary}
                </p>

                <div className="mt-3 rounded-[18px] border-2 border-[#caa57a] bg-[#fff7ea] px-3 py-3 text-sm text-[#4a301c]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8b6440]">随机主题</p>
                  <p className="mt-1 font-semibold">
                    {selectedTheme ? CITY_THEME_META[selectedTheme].icon : '🎲'}{' '}
                    {selectedTheme ? CITY_THEME_META[selectedTheme].label : '等待抽选'}
                  </p>
                  <p className="mt-1 text-xs text-[#78573a]">每次选城或重抽都会随机挑选当前城市可用主题。</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRegenerate()}
                    disabled={isGenerating}
                    className="rounded-full border-2 border-[#2a4b3d] bg-[#2f604d] px-4 py-2 text-sm text-[#f8f2e3] shadow-[0_4px_0_#1d3b30] disabled:opacity-60"
                  >
                    {isGenerating ? '生成中...' : '随机重抽主题并生成'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostcardModalOpen(true)}
                    disabled={!activePostcard}
                    className="rounded-full border-2 border-[#836036] bg-[#fff3db] px-4 py-2 text-sm text-[#4f331c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    查看明信片
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[22px] border-[3px] border-dashed border-[#b78e61] bg-[#fff7ea] px-6 text-center text-[#5b3c24]">
                <div className="text-6xl">🧳</div>
                <h2 className="mt-4 font-heading text-3xl text-[#3f2717]">先选一座城市</h2>
                <p className="mt-3 max-w-sm text-sm leading-6">点击地图图标后，系统会自动随机主题并生成明信片。</p>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-[16px] border-2 border-[#d17c5e] bg-[#fff0eb] px-3 py-2 text-sm text-[#7d2f1a]">
                {error}
              </div>
            )}
          </section>
        </div>
      </div>

      {isPostcardModalOpen && activePostcard && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="城市明信片"
          onClick={() => setPostcardModalOpen(false)}
        >
          <article
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[28px] border-[5px] border-[#43635a] bg-[#fffaf0] shadow-[0_30px_60px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b-[4px] border-[#43635a] bg-[linear-gradient(135deg,#1f4135_0%,#3d6556_100%)] px-5 py-4 text-[#f8f3e6]">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] opacity-80">
                  {getCityById(activePostcard.cityId)?.nameDe} · {CITY_THEME_META[activePostcard.theme].label}
                </p>
                <h3 className="mt-1 font-heading text-2xl">{activePostcard.title}</h3>
                <p className="mt-1 text-sm opacity-90">{activePostcard.caption}</p>
              </div>
              <button
                type="button"
                onClick={() => setPostcardModalOpen(false)}
                className="rounded-full border border-[#cfe2d8] bg-[#f8f3e7] px-3 py-1 text-sm text-[#27463a]"
              >
                关闭
              </button>
            </header>

            <img src={activePostcard.imageUrl} alt={`${activePostcard.title} postcard`} className="h-72 w-full object-cover" />

            <div className="p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleTranslationMode}
                  className="rounded-full border-2 border-[#855f35] bg-[#fff5df] px-4 py-2 text-sm text-[#4d3119]"
                >
                  {showEnglish ? '切回德文' : '翻译成英文'}
                </button>
                <button
                  type="button"
                  onClick={savePostcardToAlbum}
                  disabled={isSaved}
                  className="rounded-full border-2 border-[#315843] bg-[#e1f1e4] px-4 py-2 text-sm text-[#1e4630] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaved ? '已收藏' : '收藏明信片'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRegenerate()}
                  disabled={isGenerating}
                  className="rounded-full border-2 border-[#2c4d3f] bg-[#2f5f4c] px-4 py-2 text-sm text-[#f6f0e2] disabled:opacity-60"
                >
                  再抽一张
                </button>
              </div>

              {isGenerating && (
                <div className="mb-4 rounded-[16px] border-2 border-[#96b8a9] bg-[#f4faf6] px-4 py-3 text-sm text-[#355247]">
                  正在随机主题并生成新的明信片...
                </div>
              )}

              <div className="rounded-[22px] border-[3px] border-[#d8c1a2] bg-white px-4 py-4 text-[15px] leading-8 text-[#332116]">
                {activeParagraphs.map((paragraph, index) => (
                  <p key={`${activePostcard.id}-${index}`} className="mb-3 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </article>
        </div>
      )}

      {isAlbumModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="明信片收藏夹"
          onClick={() => setAlbumModalOpen(false)}
        >
          <section
            className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-[26px] border-[5px] border-[#4a6a60] bg-[#fff9ee] shadow-[0_28px_56px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b-[4px] border-[#4a6a60] bg-[linear-gradient(135deg,#254438_0%,#466b5d_100%)] px-5 py-4 text-[#f7f2e4]">
              <h3 className="font-heading text-2xl">明信片收藏夹</h3>
              <button
                type="button"
                onClick={() => setAlbumModalOpen(false)}
                className="rounded-full border border-[#cfe2d8] bg-[#f8f3e7] px-3 py-1 text-sm text-[#27463a]"
              >
                关闭
              </button>
            </header>

            <div className="space-y-3 p-4">
              {album.length === 0 && (
                <div className="rounded-[18px] border-[3px] border-dashed border-[#a8c5b8] bg-[#f9fbf8] p-4 text-sm leading-6 text-[#426154]">
                  还没有收藏内容，先生成一张明信片再收藏。
                </div>
              )}

              {album.map((entry) => {
                const city = getCityById(entry.postcard.cityId);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleOpenAlbumEntry(entry.id)}
                    className="block w-full rounded-[18px] border-[3px] border-[#7ea18f] bg-[#fcfffb] p-3 text-left shadow-[0_8px_0_rgba(74,107,95,0.16)] transition hover:-translate-y-1"
                  >
                    <div className="flex gap-3">
                      <img
                        src={entry.postcard.imageUrl}
                        alt={`${city?.nameDe ?? entry.postcard.cityId} saved postcard`}
                        className="h-20 w-20 rounded-[12px] border-2 border-[#90b19d] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.22em] text-[#6f927f]">
                          {city?.nameDe ?? entry.postcard.cityId} · {CITY_THEME_META[entry.postcard.theme].label}
                        </p>
                        <p className="mt-1 truncate font-semibold text-[#294236]">{entry.postcard.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-[#486254]">{entry.postcard.caption}</p>
                        <p className="mt-1 text-xs text-[#6b877a]">收藏于 {new Date(entry.savedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
