import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CITY_THEME_META, getCityById, getThemeFacts } from '../data/germanCities';
import { useExploreStore } from '../store/exploreStore';
import type { CityTheme } from '../types';

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

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

  useEffect(() => {
    initializeExplore();
  }, [initializeExplore]);

  const selectedCity = useMemo(() => {
    if (!selectedCityId) {
      return null;
    }

    return getCityById(selectedCityId) ?? null;
  }, [selectedCityId]);

  const activeThemeFacts = useMemo(() => {
    if (!selectedCity || !selectedTheme) {
      return null;
    }

    return getThemeFacts(selectedCity, selectedTheme);
  }, [selectedCity, selectedTheme]);

  const activeParagraphs = useMemo(() => {
    if (!activePostcard) {
      return [];
    }

    return splitParagraphs(showEnglish ? activePostcard.englishText : activePostcard.germanText);
  }, [activePostcard, showEnglish]);

  const isSaved = activePostcard
    ? album.some((entry) => entry.postcard.id === activePostcard.id)
    : false;

  const handleThemeSelect = async (theme: CityTheme) => {
    selectTheme(theme);
    await generatePostcard(selectedCityId ?? undefined, theme);
  };

  if (!isInitialized) {
    return <div className="p-6 text-center text-butcher-deep">正在搭建德国旅行地图...</div>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1380px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[32px] border-[5px] border-[#2e3d34] bg-[#f5edd9] shadow-[0_24px_70px_rgba(39,51,46,0.22)]">
        <div className="border-b-[5px] border-[#385043] bg-[linear-gradient(135deg,#17352d_0%,#24473b_42%,#3d6655_100%)] px-5 py-5 text-[#f7f1df] sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#cce8d4]">Germany Travel Desk</p>
              <h1 className="mt-2 font-heading text-3xl sm:text-4xl">出门旅游</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#def0e0] sm:text-base">
                从德国地图里选一座城市，按主题生成一张和当地事实绑定的德语明信片。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                to="/"
                className="rounded-full border-2 border-[#d6ebd9] bg-[#f5edd9] px-4 py-2 text-[#1f312b] shadow-[0_4px_0_#b4ccb9]"
              >
                返回营业台
              </Link>
              <Link
                to="/units"
                className="rounded-full border-2 border-[#95b9a2] bg-[#2b4d3f] px-4 py-2 text-[#f8f2e5] shadow-[0_4px_0_#1a3027]"
              >
                词库中心
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-5 bg-[linear-gradient(180deg,#efe4c8_0%,#f8f3e7_100%)] p-4 sm:p-5 xl:grid-cols-[1.18fr_0.82fr]">
          <section className="rounded-[28px] border-[4px] border-[#254237] bg-[#d2f0ef] p-3 shadow-[0_10px_0_#44665e]">
            <div className="rounded-[22px] border-[4px] border-[#335244] bg-[linear-gradient(180deg,#bbe8ff_0%,#d6f3ff_20%,#f8e7b7_100%)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-2xl text-[#17322b]">Voxel 德国地图</h2>
                  <p className="text-sm text-[#27453c]">点击城市节点进入对应城市的探索页。</p>
                </div>
                <div className="rounded-2xl border-2 border-[#54776d] bg-[#f7f5eb] px-3 py-2 text-xs text-[#29443b]">
                  已开放 {cities.length} 座城市
                </div>
              </div>

              <div className="relative aspect-[11/8] overflow-hidden rounded-[22px] border-[4px] border-[#365648] bg-[radial-gradient(circle_at_20%_15%,#f8ffff_0%,#daf4ff_24%,#9ed7ff_56%,#6cb7dc_100%)]">
                <div className="absolute inset-x-0 bottom-0 h-[28%] bg-[linear-gradient(180deg,#6eb17e_0%,#4e845c_100%)]" />
                <div className="absolute left-[12%] top-[17%] h-[64%] w-[55%] rounded-[26px] border-[5px] border-[#47634f] bg-[linear-gradient(180deg,#95d36b_0%,#7fc45d_100%)] [clip-path:polygon(32%_0%,56%_4%,78%_19%,88%_36%,84%_54%,92%_71%,78%_91%,54%_100%,30%_94%,11%_72%,14%_52%,5%_33%,16%_16%)] shadow-[14px_16px_0_rgba(44,74,49,0.38)]">
                  <div className="absolute inset-[8%] opacity-35 [background-image:linear-gradient(to_right,rgba(66,101,72,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(66,101,72,0.35)_1px,transparent_1px)] [background-size:34px_34px]" />
                  <div className="absolute bottom-[18%] left-[18%] h-[12%] w-[28%] rounded-[8px] bg-[#5aa0d8] shadow-[0_8px_0_rgba(41,86,122,0.25)]" />
                  <div className="absolute right-[18%] top-[24%] h-[9%] w-[12%] rounded-[6px] bg-[#8ec8ec]" />
                  <div className="absolute left-[43%] top-[32%] h-[10%] w-[10%] rounded-[6px] bg-[#dfeec2]" />
                </div>

                <div className="absolute inset-0">
                  {cities.map((city) => {
                    const active = city.id === selectedCityId;
                    return (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => {
                          clearError();
                          selectCity(city.id);
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[18px] border-[3px] px-3 py-2 text-left shadow-[0_7px_0_rgba(45,54,45,0.26)] transition hover:-translate-y-[54%] ${
                          active
                            ? 'border-[#ffefc9] bg-[#284b3d] text-[#fff4db]'
                            : 'border-[#385c4c] bg-[#f5eedf] text-[#1f3028]'
                        }`}
                        style={{ left: city.mapPosition.left, top: city.mapPosition.top }}
                      >
                        <span className="block text-[11px] uppercase tracking-[0.2em] opacity-75">Stadt</span>
                        <span className="block font-heading text-lg leading-none">{city.nameDe}</span>
                        <span className="mt-1 block text-xs opacity-80">{city.nameEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border-[4px] border-[#704f2d] bg-[linear-gradient(180deg,#f9efdc_0%,#f2ddba_100%)] p-4 shadow-[0_10px_0_#8a6845]">
            {selectedCity ? (
              <>
                <p className="text-xs uppercase tracking-[0.28em] text-[#8e6536]">Selected City</p>
                <h2 className="mt-2 font-heading text-3xl text-[#382313]">{selectedCity.nameDe}</h2>
                <p className="text-sm text-[#67472b]">
                  {selectedCity.nameEn} · {selectedCity.countryRegion}
                </p>
                <p className="mt-3 rounded-2xl border border-[#d3b286] bg-[#fff6e8] px-4 py-3 text-sm leading-6 text-[#4a2f1c]">
                  {selectedCity.summary}
                </p>
                <img
                  src={selectedCity.imageUrl}
                  alt={`${selectedCity.nameDe} postcard art`}
                  className="mt-4 h-52 w-full rounded-[22px] border-[4px] border-[#845b36] object-cover shadow-[0_10px_0_#b58c63]"
                />
                <div className="mt-4 rounded-[22px] border-[3px] border-[#916437] bg-[#fffaf0] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-heading text-xl text-[#442715]">主题入口</h3>
                    {selectedTheme && (
                      <span className="rounded-full border border-[#d2b083] bg-[#f5ead8] px-3 py-1 text-xs text-[#5d4128]">
                        当前主题: {CITY_THEME_META[selectedTheme].label}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(Object.keys(CITY_THEME_META) as CityTheme[]).map((theme) => {
                      const meta = CITY_THEME_META[theme];
                      const facts = getThemeFacts(selectedCity, theme);
                      const active = theme === selectedTheme;
                      return (
                        <button
                          key={theme}
                          type="button"
                          disabled={!facts.available || isGenerating}
                          onClick={() => void handleThemeSelect(theme)}
                          className={`rounded-[20px] border-[3px] px-4 py-3 text-left shadow-[0_8px_0_rgba(88,62,34,0.16)] transition ${
                            facts.available
                              ? active
                                ? 'border-[#2d4b3f] bg-[#27483c] text-[#fff2da]'
                                : 'border-[#c6a477] bg-[#fff3de] text-[#3c2718] hover:-translate-y-1'
                              : 'cursor-not-allowed border-[#d9c4a8] bg-[#f3ebde] text-[#8a7765] opacity-75'
                          }`}
                        >
                          <span className="text-2xl">{meta.icon}</span>
                          <span className="mt-2 block font-semibold">{meta.label}</span>
                          <span className="mt-1 block text-xs leading-5 opacity-80">
                            {facts.available ? `关键词: ${facts.keywords.slice(0, 3).join(' / ')}` : facts.unavailableReason}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[22px] border-[3px] border-dashed border-[#b78e61] bg-[#fff7ea] px-6 text-center text-[#5b3c24]">
                <div className="text-6xl">🧭</div>
                <h2 className="mt-4 font-heading text-3xl text-[#3f2717]">先从地图里挑一个城市</h2>
                <p className="mt-3 max-w-sm text-sm leading-6">
                  选城之后才能看到当地简介、可用主题，以及按本地事实生成的德语明信片。
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-5 bg-[#f8f3e8] p-4 sm:p-5 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[28px] border-[4px] border-[#7b5631] bg-[linear-gradient(180deg,#f5d9b8_0%,#f9efe2_100%)] p-4 shadow-[0_12px_0_#a67a50]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#9b7244]">Postcard Reader</p>
                <h2 className="mt-2 font-heading text-2xl text-[#3d2514]">城市明信片</h2>
              </div>
              {selectedCity && selectedTheme && (
                <button
                  type="button"
                  onClick={() => void generatePostcard()}
                  disabled={isGenerating}
                  className="rounded-full border-2 border-[#4b6a58] bg-[#214336] px-4 py-2 text-sm text-[#fff4dc] shadow-[0_4px_0_#172d25] disabled:opacity-60"
                >
                  {isGenerating ? '正在生成...' : '重新生成'}
                </button>
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-[18px] border-2 border-[#d17c5e] bg-[#fff0eb] px-4 py-3 text-sm text-[#7c2f19]">
                {error}
              </div>
            )}

            {isGenerating && (
              <div className="mt-4 rounded-[24px] border-[3px] border-[#5f7f6a] bg-[#f6f8f1] p-5 text-sm text-[#355145]">
                正在根据 {selectedCity?.nameDe} 的当地事实生成德语明信片...
              </div>
            )}

            {!isGenerating && activePostcard && (
              <article className="mt-4 overflow-hidden rounded-[26px] border-[4px] border-[#4a6b61] bg-[#fcfaf2] shadow-[0_16px_0_#b7c7bf]">
                <img
                  src={activePostcard.imageUrl}
                  alt={`${getCityById(activePostcard.cityId)?.nameDe ?? activePostcard.cityId} postcard`}
                  className="h-64 w-full object-cover"
                />
                <div className="border-t-[4px] border-[#4a6b61] bg-[linear-gradient(180deg,#fff9eb_0%,#fff5e1_100%)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.26em] text-[#8d6640]">
                        {getCityById(activePostcard.cityId)?.nameDe} · {CITY_THEME_META[activePostcard.theme].label}
                      </p>
                      <h3 className="mt-2 font-heading text-3xl text-[#3a2313]">{activePostcard.title}</h3>
                      <p className="mt-2 text-sm text-[#67482c]">{activePostcard.caption}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={toggleTranslationMode}
                        className="rounded-full border-2 border-[#845f33] bg-[#fff5de] px-4 py-2 text-sm text-[#4d3119]"
                      >
                        {showEnglish ? '切回德文' : '翻译成英文'}
                      </button>
                      <button
                        type="button"
                        onClick={savePostcardToAlbum}
                        disabled={isSaved}
                        className="rounded-full border-2 border-[#315843] bg-[#e1f1e4] px-4 py-2 text-sm text-[#1e4630] disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        {isSaved ? '已收藏' : '收藏明信片'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[20px] border-[3px] border-[#d9c1a0] bg-white px-4 py-4 text-[15px] leading-8 text-[#332116]">
                    {activeParagraphs.map((paragraph, index) => (
                      <p key={`${activePostcard.id}-${index}`} className="mb-3 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  {activeThemeFacts?.available && (
                    <div className="mt-4 rounded-[18px] border-2 border-dashed border-[#cfb08b] bg-[#fff7eb] px-4 py-3 text-xs leading-6 text-[#674a2c]">
                      生成依据: {activeThemeFacts.keywords.join(' / ')}
                    </div>
                  )}
                </div>
              </article>
            )}

            {!isGenerating && !activePostcard && !error && (
              <div className="mt-4 rounded-[24px] border-[3px] border-dashed border-[#caa77d] bg-[#fff8ec] p-6 text-sm leading-6 text-[#68482b]">
                {selectedCity
                  ? '选择一个主题后，这里会生成和当地事实对应的德语明信片。'
                  : '先从地图上选城市，再继续选择主题。'}
              </div>
            )}
          </section>

          <aside className="rounded-[28px] border-[4px] border-[#315240] bg-[linear-gradient(180deg,#dcefe6_0%,#f4f7ef_100%)] p-4 shadow-[0_12px_0_#6d8e80]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#5f8571]">Collection</p>
                <h2 className="mt-2 font-heading text-2xl text-[#22372f]">明信片收藏册</h2>
              </div>
              <div className="rounded-full border-2 border-[#9cc0ae] bg-[#f7faf6] px-3 py-1 text-xs text-[#365545]">
                {album.length} 张
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {album.length === 0 && (
                <div className="rounded-[20px] border-[3px] border-dashed border-[#a8c5b8] bg-[#f9fbf8] p-4 text-sm leading-6 text-[#426154]">
                  还没有收藏的明信片。生成一张满意的城市卡片后，可以把它存进这里。
                </div>
              )}

              {album.map((entry) => {
                const city = getCityById(entry.postcard.cityId);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openAlbumEntry(entry.id)}
                    className="block w-full rounded-[22px] border-[3px] border-[#7ea18f] bg-[#fcfffb] p-3 text-left shadow-[0_8px_0_rgba(74,107,95,0.16)] transition hover:-translate-y-1"
                  >
                    <div className="flex gap-3">
                      <img
                        src={entry.postcard.imageUrl}
                        alt={`${city?.nameDe ?? entry.postcard.cityId} saved postcard`}
                        className="h-24 w-24 rounded-[16px] border-2 border-[#90b19d] object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.22em] text-[#6f927f]">
                          {city?.nameDe ?? entry.postcard.cityId} · {CITY_THEME_META[entry.postcard.theme].label}
                        </p>
                        <p className="mt-1 truncate font-semibold text-[#294236]">{entry.postcard.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-[#486254]">{entry.postcard.caption}</p>
                        <p className="mt-2 text-xs text-[#6b877a]">
                          收藏于 {new Date(entry.savedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
