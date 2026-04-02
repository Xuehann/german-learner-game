import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ALT_CHAR_MAP } from '../lib/germanInput';
import {
  countRemainingUnmastered,
  getDayAccuracy,
  getPlanProgress,
  resolveLearningPool,
  SAUSAGE_CATALOG,
  useGameStore
} from '../store/gameStore';
import type { Customer, Order, SausageSkin } from '../types';

const splitAnswer = (value: string): string[] => value.trim().split(/\s+/).filter(Boolean);

const buildSingleHint = (answer: string): string => {
  const parts = splitAnswer(answer);
  if (parts.length === 0) {
    return '无可用提示';
  }

  const maybeArticle = /^(der|die|das)$/i.test(parts[0] ?? '') ? (parts[0] ?? '').toLowerCase() : null;
  const body = maybeArticle ? parts.slice(1).join(' ') : parts.join(' ');
  const visible = body.slice(0, 2);
  const length = body.replace(/\s+/g, '').length;

  if (maybeArticle) {
    return `冠词 ${maybeArticle}；主体前缀 ${visible || '-'}；主体长度 ${length}`;
  }

  return `前缀 ${visible || '-'}；长度 ${length}`;
};

function buildOrderHint(order: Order | null): string {
  if (!order) {
    return '';
  }

  if (order.type === 'combo') {
    const first = buildSingleHint(order.lines[0]?.german ?? '');
    const second = buildSingleHint(order.lines[1]?.german ?? '');
    return `1) ${first}；2) ${second}`;
  }

  return buildSingleHint(order.lines[0]?.german ?? '');
}

const SKIN_PALETTE: Record<string, { shell: string; core: string; fleck: string }> = {
  'classic-link': { shell: '#bd6a3a', core: '#d8945f', fleck: '#7e4227' },
  'pepper-twist': { shell: '#9d5531', core: '#c07d4c', fleck: '#2d1f17' },
  'smoked-brick': { shell: '#7d4734', core: '#9e634c', fleck: '#3f281d' },
  'amber-cube': { shell: '#a36232', core: '#cd8b53', fleck: '#6a3f1f' },
  'emerald-sausage': { shell: '#2f764d', core: '#4b996a', fleck: '#1a4a31' },
  'royal-banner': { shell: '#8a6734', core: '#b19051', fleck: '#5a421f' }
};

const skinPalette = (skin: SausageSkin | null) => {
  if (!skin) {
    return SKIN_PALETTE['classic-link'];
  }

  return SKIN_PALETTE[skin.id] ?? SKIN_PALETTE['classic-link'];
};

const CUSTOMER_PORTRAITS: Record<string, string> = {
  Anna: '/images/customers/anna.webp',
  Lukas: '/images/customers/lukas.webp',
  Mia: '/images/customers/mia.webp',
  Jonas: '/images/customers/jonas.webp',
  Lea: '/images/customers/lea.webp',
  Noah: '/images/customers/noah.webp',
  Emma: '/images/customers/emma.webp',
  Paul: '/images/customers/paul.webp'
};

const DEFAULT_CUSTOMER_PORTRAIT = '/images/customers/default.webp';
const IDLE_CUSTOMER_SPEECH = 'Ich warte auf meine Bestellung.';
const EMPTY_QUEUE_SPEECH = 'Naechster, bitte.';

function CustomerPortrait({ customer }: { customer: Customer | null }) {
  const [fallbackStage, setFallbackStage] = useState<'primary' | 'default' | 'emoji'>('primary');

  useEffect(() => {
    setFallbackStage('primary');
  }, [customer?.id]);

  if (!customer) {
    return (
      <div className="flex h-[112px] w-[86px] items-center justify-center rounded border border-[#866443] bg-[#f5e6d4] text-xs text-[#6a4a2d] sm:h-[132px] sm:w-[102px] lg:h-[156px] lg:w-[118px]">
        无顾客
      </div>
    );
  }

  const namedPortrait = CUSTOMER_PORTRAITS[customer.name];
  const src =
    fallbackStage === 'primary'
      ? namedPortrait ?? DEFAULT_CUSTOMER_PORTRAIT
      : fallbackStage === 'default'
        ? DEFAULT_CUSTOMER_PORTRAIT
        : null;

  if (!src) {
    return (
      <div className="flex h-[112px] w-[86px] items-center justify-center rounded border border-[#866443] bg-[#f5e6d4] text-4xl sm:h-[132px] sm:w-[102px] lg:h-[156px] lg:w-[118px]">
        {customer.avatar}
      </div>
    );
  }

  return (
    <div className="h-[112px] w-[86px] overflow-hidden rounded border border-[#866443] bg-[#f5e6d4] sm:h-[132px] sm:w-[102px] lg:h-[156px] lg:w-[118px]">
      <img
        src={src}
        alt={`${customer.name} portrait`}
        className="h-full w-full object-contain p-1"
        style={{ imageRendering: 'pixelated' }}
        onError={() => {
          setFallbackStage((prev) => (prev === 'primary' ? 'default' : 'emoji'));
        }}
      />
    </div>
  );
}

export function GamePage() {
  const {
    isInitialized,
    phase,
    businessDay,
    allWords,
    learningUnits,
    unitWordsMap,
    activeUnitId,
    wordProgressMap,
    orderQueue,
    currentOrder,
    currentInput,
    feedback,
    settings,
    satisfaction,
    coins,
    collection,
    answers,
    startBusinessDay,
    advanceIntro,
    openShop,
    closeShop,
    applyPlanAdjustmentAndStartNextDay,
    updatePlanDaysForCurrentDay,
    setInput,
    appendSpecialChar,
    submitOrderAnswer,
    skipOrder,
    continueAfterFeedback,
    redeemSausage,
    setDisplaySausage,
    resetAllLocalData
  } = useGameStore();

  const [showHint, setShowHint] = useState(false);
  const [cutAnimTick, setCutAnimTick] = useState(0);
  const [nextPlanDays, setNextPlanDays] = useState(settings.planDays);
  const [showIntroGoalEditor, setShowIntroGoalEditor] = useState(false);
  const [introGoalPlanDaysInput, setIntroGoalPlanDaysInput] = useState(String(settings.planDays));
  const [introGoalPlanDaysError, setIntroGoalPlanDaysError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const learningPool = useMemo(() => resolveLearningPool(allWords), [allWords]);
  const remainingUnmastered = useMemo(
    () => countRemainingUnmastered(learningPool, wordProgressMap),
    [learningPool, wordProgressMap]
  );
  const livePlanProgress = useMemo(
    () => getPlanProgress(settings.planStartDate, settings.planDays),
    [settings.planStartDate, settings.planDays]
  );

  const accuracy = getDayAccuracy(businessDay?.progress ?? null);

  const goal = businessDay?.goal ?? {
    newMasteredTarget: 0,
    correctedMistakesTarget: 0
  };

  const progress = businessDay?.progress ?? {
    newMastered: 0,
    correctedMistakes: 0,
    servedOrders: 0,
    correctOrders: 0
  };

  const planDayIndex = businessDay?.planDayIndex ?? livePlanProgress.dayIndex;
  const planDaysLeft = businessDay?.planDaysLeft ?? livePlanProgress.daysLeft;
  const planPoolSize = businessDay?.planPoolSize ?? learningPool.length;
  const currentCustomer = currentOrder?.customer ?? null;
  const customerSpeech = feedback?.speech ?? (currentCustomer ? IDLE_CUSTOMER_SPEECH : EMPTY_QUEUE_SPEECH);

  const masteredPct =
    goal.newMasteredTarget <= 0
      ? 100
      : Math.min(100, Math.round((progress.newMastered / goal.newMasteredTarget) * 100));

  const correctedPct =
    goal.correctedMistakesTarget <= 0
      ? 100
      : Math.min(100, Math.round((progress.correctedMistakes / goal.correctedMistakesTarget) * 100));

  const activeSkin = SAUSAGE_CATALOG.find((skin) => skin.id === collection.displaySkinId) ?? null;
  const palette = skinPalette(activeSkin);

  const ownedSkins = SAUSAGE_CATALOG.filter((skin) => collection.ownedSkinIds.includes(skin.id));
  const activeUnit = learningUnits.find((unit) => unit.id === activeUnitId) ?? null;
  const activeUnitWordCount = activeUnitId ? (unitWordsMap[activeUnitId]?.length ?? 0) : 0;
  const planSummaryCard = (
    <div className="rounded-md border-2 border-[#6a4a2b] bg-[#fff5e6] px-3 py-2 text-sm text-[#3b2918]">
      <p>
        学习计划: 第 {planDayIndex} 天 · 剩余 {planDaysLeft} 天 · 词池 {planPoolSize}
      </p>
      <p>剩余未掌握: {remainingUnmastered} · 今日准确率: {accuracy}%</p>
      <p className="mt-1 text-xs">
        当前学习单元: {activeUnit ? `${activeUnit.name}（${activeUnitWordCount} 词）` : '试玩词池（内置）'}
      </p>
      <Link
        to="/units"
        className="mt-2 inline-block rounded border border-[#7c5635] bg-[#fff2df] px-2 py-1 text-xs text-[#3f2b19]"
      >
        词库中心
      </Link>
      <Link
        to="/explore"
        className="ml-2 mt-2 inline-block rounded border border-[#315240] bg-[#e5f5eb] px-2 py-1 text-xs text-[#244136]"
      >
        出门旅游
      </Link>
      <button
        type="button"
        onClick={() => resetAllLocalData()}
        className="ml-2 mt-2 rounded border border-[#7c5635] bg-[#ffe8c8] px-2 py-1 text-xs text-[#3f2b19]"
      >
        清空进度并重开
      </button>
    </div>
  );

  useEffect(() => {
    setShowHint(false);
  }, [currentOrder?.id]);

  useEffect(() => {
    if (phase === 'serving_order') {
      inputRef.current?.focus();
    }
  }, [phase, currentOrder?.id]);

  useEffect(() => {
    if (phase === 'show_order_feedback' && feedback?.type === 'correct') {
      setCutAnimTick((prev) => prev + 1);
    }
  }, [feedback?.type, phase]);

  useEffect(() => {
    if (phase !== 'show_order_feedback') {
      return undefined;
    }

    if (feedback?.requiresManualContinue) {
      return undefined;
    }

    const timer = window.setTimeout(() => continueAfterFeedback(), settings.feedbackDelayMs);
    return () => window.clearTimeout(timer);
  }, [continueAfterFeedback, feedback?.requiresManualContinue, phase, settings.feedbackDelayMs]);

  useEffect(() => {
    if (phase !== 'show_order_feedback' || !feedback?.requiresManualContinue) {
      return undefined;
    }

    const handleEnter = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      continueAfterFeedback();
    };

    window.addEventListener('keydown', handleEnter);
    return () => window.removeEventListener('keydown', handleEnter);
  }, [continueAfterFeedback, feedback?.requiresManualContinue, phase]);

  useEffect(() => {
    if (phase === 'day_summary') {
      setNextPlanDays(settings.planDays);
    }
  }, [phase, settings.planDays]);

  useEffect(() => {
    if (phase !== 'intro_goal') {
      setShowIntroGoalEditor(false);
      setIntroGoalPlanDaysError(null);
      return;
    }

    setIntroGoalPlanDaysInput(String(settings.planDays));
    setIntroGoalPlanDaysError(null);
  }, [phase, settings.planDays]);

  if (!isInitialized || !businessDay) {
    return <div className="p-6 text-center text-butcher-deep">正在准备德国肉铺经营看板...</div>;
  }

  const handleInputChange = (value: string) => {
    setInput(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.altKey) {
      return;
    }

    const mapped = ALT_CHAR_MAP[event.key.toLowerCase()];
    if (mapped) {
      event.preventDefault();
      appendSpecialChar(mapped);
    }
  };

  const isServing = phase === 'serving_order';
  const disabledInput = !isServing || !currentOrder;
  const isSuccessfulCut = phase === 'show_order_feedback' && feedback?.type === 'correct';

  const saveIntroGoalPlanDays = () => {
    const parsed = Number.parseInt(introGoalPlanDaysInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
      setIntroGoalPlanDaysError('请输入 1-30 的整数天数。');
      return;
    }

    updatePlanDaysForCurrentDay(parsed);
    setShowIntroGoalEditor(false);
    setIntroGoalPlanDaysError(null);
    setIntroGoalPlanDaysInput(String(parsed));
  };

  const showBusinessBoard =
    phase === 'serving_order' || phase === 'show_order_feedback' || phase === 'shop' || phase === 'intro_goal';

  return (
    <main className="mx-auto min-h-screen max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-2xl border-4 border-[#3b2c20] bg-[#c8a079] p-2 shadow-[0_10px_0_#2f2117]">
        <div className="rounded-xl border-4 border-[#6f4c2d] bg-[linear-gradient(135deg,#e5c9a5_0%,#dcb98e_45%,#cfa678_100%)] p-4 sm:p-5">
          {phase !== 'intro_door' && (
            <header className="mb-4 rounded-lg border-4 border-[#4e341e] bg-[#f2ddbf] p-3 shadow-[0_4px_0_#7f5c39]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1
                    className="font-signboard text-[2.25rem] leading-[1.02] tracking-[0.015em] text-[#2d1f12] sm:text-[3rem]"
                    style={{ textShadow: '0 1px 0 rgba(255, 237, 212, 0.7), 0 3px 8px rgba(74, 43, 24, 0.35)' }}
                >
                  Wortwurst Metzgerei
                </h1>
                <p className="text-sm text-[#4e341e]">开门迎客，按计划完成经营目标！</p>
              </div>
                {planSummaryCard}
              </div>
            </header>
          )}

          {phase === 'intro_door' && (
            <section className="relative aspect-[43/24] overflow-hidden rounded-lg border-4 border-[#4b3018] bg-[linear-gradient(180deg,#3f2b1d_0%,#22170f_100%)] text-[#fbe8cf] shadow-[0_5px_0_#7e5a34]">
              <div
                className="absolute inset-0 bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/images/intro-door-bg.png')" }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(30,20,12,0.12)_0%,rgba(25,16,10,0.18)_58%,rgba(20,12,8,0.26)_100%)]" />

              <div className="relative z-10 h-full p-4 sm:p-6">
                <div className="absolute right-3 top-3 z-20 max-w-[min(100%,360px)]">
                  {planSummaryCard}
                </div>
                <div
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ bottom: 'calc(clamp(16px, 4vh, 40px) + env(safe-area-inset-bottom))' }}
                >
                  <div className="flex flex-wrap items-end justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => advanceIntro()}
                      className="rounded border-4 border-[#244e31] bg-[#3d8f54] px-6 py-2 text-white shadow-[0_4px_0_#1f3f2a]"
                    >
                      推门营业
                    </button>
                    <Link
                      to="/explore"
                      className="rounded border-4 border-[#315240] bg-[#3d8f54] px-6 py-2 text-white shadow-[0_4px_0_#23372f]"
                    >
                      出门旅游
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {phase === 'intro_goal' && (
            <section className="rounded-lg border-4 border-[#4b3018] bg-[#fff5e8] p-6 text-[#2f2012] shadow-[0_5px_0_#7e5a34]">
              <h2 className="text-center font-heading text-3xl">今日运营目标</h2>
              <div className="mx-auto mt-4 max-w-xl rounded border-2 border-[#7a5c3a] bg-[#fffaf0] p-4 text-sm">
                <p>新增掌握词目标: {goal.newMasteredTarget}</p>
                <p>纠错目标: {goal.correctedMistakesTarget}</p>
                <p>当前金币: {coins.balance}</p>
                <p>计划剩余天数: {planDaysLeft}</p>
              </div>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => advanceIntro()}
                  className="rounded border-4 border-[#244e31] bg-[#3d8f54] px-6 py-2 text-white shadow-[0_4px_0_#1f3f2a]"
                >
                  开始营业
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowIntroGoalEditor(true);
                    setIntroGoalPlanDaysInput(String(settings.planDays));
                    setIntroGoalPlanDaysError(null);
                  }}
                  className="rounded border-4 border-[#5a4631] bg-[#9a7a54] px-6 py-2 text-white shadow-[0_4px_0_#4b3826]"
                >
                  修改计划
                </button>
              </div>

              {showIntroGoalEditor && (
                <div className="mx-auto mt-4 max-w-xl rounded border-2 border-[#7a5c3a] bg-[#fffaf0] p-3 text-sm">
                  <p className="text-xs text-[#5a3f27]">设置几天内完成当前学习计划（1-30 天）。</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      value={introGoalPlanDaysInput}
                      onChange={(event) => {
                        setIntroGoalPlanDaysInput(event.target.value);
                        if (introGoalPlanDaysError) {
                          setIntroGoalPlanDaysError(null);
                        }
                      }}
                      className="w-28 rounded border border-[#8b6944] bg-white px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={saveIntroGoalPlanDays}
                      className="rounded border border-[#335f3e] bg-[#e6f6dd] px-3 py-1"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowIntroGoalEditor(false);
                        setIntroGoalPlanDaysError(null);
                        setIntroGoalPlanDaysInput(String(settings.planDays));
                      }}
                      className="rounded border border-[#8a6540] bg-white px-3 py-1"
                    >
                      取消
                    </button>
                  </div>
                  {introGoalPlanDaysError && <p className="mt-2 text-xs text-[#8d2a1d]">{introGoalPlanDaysError}</p>}
                </div>
              )}
            </section>
          )}

          {showBusinessBoard && (
            <div className="mb-4 flex items-center justify-end gap-2">
              {phase !== 'shop' ? (
                <button
                  type="button"
                  onClick={() => openShop()}
                  className="rounded border-4 border-[#69431f] bg-[#b97531] px-4 py-2 text-white shadow-[0_4px_0_#633814]"
                >
                  商店（金币兑换）
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => closeShop()}
                  className="rounded border-4 border-[#265735] bg-[#3d8f54] px-4 py-2 text-white shadow-[0_4px_0_#1f3f2a]"
                >
                  返回营业台
                </button>
              )}
            </div>
          )}

          {phase === 'shop' && (
            <section className="rounded-lg border-4 border-[#4b3018] bg-[#f7e8d1] p-4 shadow-[0_5px_0_#7e5a34]">
              <h2 className="text-2xl font-heading text-[#2f2012]">香肠商店</h2>
              <p className="mt-1 text-sm text-[#3e2b19]">余额: {coins.balance} 金币</p>
              <p className="text-xs text-[#5a3f27]">已拥有的香肠可在营业案板右侧快捷切换。</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {SAUSAGE_CATALOG.map((skin) => {
                  const owned = collection.ownedSkinIds.includes(skin.id);
                  const isActive = collection.displaySkinId === skin.id;

                  return (
                    <article key={skin.id} className="rounded border-2 border-[#8a6540] bg-[#fff8ed] p-3 text-sm text-[#3f2b19]">
                      <p className="font-semibold">
                        {skin.emoji} {skin.name}
                      </p>
                      <p className="mt-1 text-xs">{skin.description}</p>
                      <p className="mt-1 text-xs">稀有度: {skin.rarity} · 价格: {skin.price}</p>
                      {owned ? (
                        <button
                          type="button"
                          onClick={() => setDisplaySausage(skin.id)}
                          className={`mt-2 rounded border px-3 py-1 text-xs ${
                            isActive
                              ? 'border-[#335f3e] bg-[#dff8d4] text-[#224a2e]'
                              : 'border-[#5a4631] bg-white text-[#3f2b19]'
                          }`}
                        >
                          {isActive ? '当前使用中' : '切换到案板'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => redeemSausage(skin.id)}
                          disabled={coins.balance < skin.price}
                          className="mt-2 rounded border border-[#6b4b29] bg-[#ffe1b9] px-3 py-1 text-xs disabled:opacity-45"
                        >
                          金币兑换
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {(phase === 'serving_order' || phase === 'show_order_feedback') && (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.55fr_1.2fr]">
              <section className="rounded-lg border-4 border-[#4b3018] bg-[#f8e5ca] p-3 shadow-[0_5px_0_#7e5a34]">
                <h2 className="mb-2 text-lg font-semibold text-[#2f2114]">顾客预告</h2>
                <div className="space-y-2">
                  {orderQueue.slice(1).map((order, idx) => (
                    <article
                      key={order.id}
                      className="rounded border-2 border-[#8a6640] bg-[#fff4e4] px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-[#3a2817]">
                        #{idx + 1} {order.customer.avatar} {order.customer.name}
                      </p>
                      <p className="mt-1 text-xs text-[#3f2c1b]">{order.prompt}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border-4 border-[#4b3018] bg-[#fbe9cf] p-4 shadow-[0_5px_0_#7e5a34]">
                <div className="mb-3 rounded border-2 border-[#7d5a37] bg-[#fff6e7] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#6a4a2d]">当前顾客</p>
                  <motion.div
                    key={currentOrder?.id ?? 'none'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="mt-1"
                  >
                    <p className="text-lg font-semibold text-[#2f2012]">{currentCustomer ? currentCustomer.name : '等待顾客...'}</p>
                    <div className="mt-2 flex items-end gap-3">
                      <CustomerPortrait customer={currentCustomer} />
                      <div className="relative max-w-[320px] rounded-lg border-2 border-[#7f5d3a] bg-[#fff7ea] px-3 py-2 text-sm text-[#2f2012] shadow-[0_2px_0_#c9a77f]">
                        <span className="pointer-events-none absolute -left-[7px] bottom-5 h-3 w-3 rotate-45 border-b-2 border-l-2 border-[#7f5d3a] bg-[#fff7ea]" />
                        <p className="font-semibold">{customerSpeech}</p>
                      </div>
                    </div>
                    <p className="text-sm text-[#5b4128]">{currentOrder?.prompt ?? ''}</p>
                    <p className="text-xs text-[#6a4a2d]">{currentOrder?.instruction ?? ''}</p>
                  </motion.div>
                </div>

                <div className="mb-3 rounded border-2 border-[#7d5a37] bg-[#fff6e7] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#6a4a2d]">切肠工作台</p>
                  <div className="relative mt-2 h-28 overflow-hidden rounded border border-[#8f6a43] bg-[linear-gradient(180deg,#f8e7cf_0%,#e8c6a0_100%)]">
                    <div className="absolute inset-x-6 top-[54px] h-12 rounded-xl border border-[#8f6a43] bg-[linear-gradient(180deg,#d7a976_0%,#bc8a58_100%)]" />

                    <motion.div
                      key={`knife-${cutAnimTick}`}
                      data-testid="knife"
                      className="absolute right-8 top-[10px] h-14 w-[10px] origin-top rounded-sm bg-[#2f3138] shadow-[0_2px_0_#18191d]"
                      initial={{ y: -34, rotate: -24 }}
                      animate={
                        feedback?.type === 'correct'
                          ? { y: [-34, 16, 16], rotate: [-24, -6, -6] }
                          : { y: -34, rotate: -24 }
                      }
                      transition={{ duration: 1.05, ease: 'easeInOut' }}
                    />

                    {isSuccessfulCut ? (
                      <>
                        <motion.div
                          key={`left-piece-${cutAnimTick}`}
                          data-testid="sausage-half-left"
                          className="absolute left-[calc(50%-82px)] top-[58px] h-8 w-[74px] rounded-l-full border-2"
                          style={{ borderColor: palette.fleck, background: palette.shell }}
                          initial={{ x: 0, rotate: 0 }}
                          animate={{ x: -26, rotate: -11 }}
                          transition={{ duration: 1.05, ease: 'easeInOut' }}
                        >
                          <div
                            className="mx-1 mt-[5px] h-[18px] rounded-l-full"
                            style={{ background: `linear-gradient(180deg, ${palette.core} 0%, ${palette.shell} 100%)` }}
                          />
                        </motion.div>

                        <motion.div
                          key={`right-piece-${cutAnimTick}`}
                          data-testid="sausage-half-right"
                          className="absolute left-[calc(50%-2px)] top-[58px] h-8 w-[74px] rounded-r-full border-2"
                          style={{ borderColor: palette.fleck, background: palette.shell }}
                          initial={{ x: 0, rotate: 0 }}
                          animate={{ x: 26, rotate: 11 }}
                          transition={{ duration: 1.05, ease: 'easeInOut' }}
                        >
                          <div
                            className="mx-1 mt-[5px] h-[18px] rounded-r-full"
                            style={{ background: `linear-gradient(180deg, ${palette.core} 0%, ${palette.shell} 100%)` }}
                          />
                        </motion.div>
                      </>
                    ) : (
                      <div
                        data-testid="sausage-whole"
                        className="absolute left-[calc(50%-82px)] top-[58px] h-8 w-[154px] rounded-full border-2"
                        style={{ borderColor: palette.fleck, background: palette.shell }}
                      >
                        <div
                          className="mx-1 mt-[5px] h-[18px] rounded-full"
                          style={{ background: `linear-gradient(180deg, ${palette.core} 0%, ${palette.shell} 100%)` }}
                        />
                      </div>
                    )}

                    <AnimatePresence>
                      {feedback?.type === 'correct' && phase === 'show_order_feedback' && (
                        <motion.div
                          className="absolute left-1/2 top-11 h-1 w-1 rounded-full bg-[#f5dfbf]"
                          initial={{ opacity: 0, scale: 0.4 }}
                          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 0.6], y: [-2, -16, -24] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.9 }}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {ownedSkins.map((skin) => {
                      const active = collection.displaySkinId === skin.id;
                      return (
                        <button
                          key={skin.id}
                          type="button"
                          onClick={() => setDisplaySausage(skin.id)}
                          className={`rounded border px-2 py-1 text-xs ${
                            active
                              ? 'border-[#335f3e] bg-[#dff8d4] text-[#224a2e]'
                              : 'border-[#8a6540] bg-[#fff6e8] text-[#3f2b19]'
                          }`}
                        >
                          {skin.emoji} {skin.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitOrderAnswer();
                  }}
                >
                  <label htmlFor="order-input" className="block text-sm font-semibold text-[#3b2918]">
                    输入答案
                  </label>
                  <input
                    id="order-input"
                    ref={inputRef}
                    value={currentInput}
                    onChange={(event) => handleInputChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabledInput}
                    placeholder="例如: der Apfel"
                    className="w-full rounded border-2 border-[#7a5b39] bg-white px-3 py-3 text-lg text-[#2f2012] outline-none ring-[#94653a]/30 focus:ring disabled:cursor-not-allowed disabled:bg-stone-100"
                  />
                  <p className="text-xs text-[#5f4329]">快捷键: Alt+A/O/U/S {'->'} ä/ö/ü/ß</p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={disabledInput}
                      className="rounded border-4 border-[#265735] bg-[#3d8f54] px-4 py-2 text-white shadow-[0_4px_0_#1f3f2a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      提交订单
                    </button>
                    <button
                      type="button"
                      onClick={() => skipOrder()}
                      disabled={disabledInput}
                      className="rounded border-4 border-[#69431f] bg-[#b97531] px-4 py-2 text-white shadow-[0_4px_0_#633814] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      跳过
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHint((prev) => !prev)}
                      disabled={disabledInput}
                      className="rounded border-4 border-[#5a4631] bg-[#9a7a54] px-4 py-2 text-white shadow-[0_4px_0_#4b3826] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      提示
                    </button>
                  </div>
                </form>

                {showHint && currentOrder && (
                  <p className="mt-3 rounded border-2 border-[#786040] bg-[#fff1d9] px-3 py-2 text-sm text-[#3f2b18]">
                    提示: {buildOrderHint(currentOrder)}
                  </p>
                )}

                {feedback && (
                  <div
                    className={`mt-4 rounded border-2 p-3 text-sm ${
                      feedback.type === 'correct'
                        ? 'border-[#2d6b3e] bg-[#e9ffdb] text-[#1f4a2b]'
                        : feedback.type === 'wrong'
                          ? 'border-[#8d2a1d] bg-[#ffe3de] text-[#6d2117]'
                        : 'border-[#6c542f] bg-[#fff1da] text-[#5c4424]'
                    }`}
                  >
                    <p className="font-semibold">订单纠错信息</p>
                    <p>{feedback.title}</p>
                    <p>正确答案: {feedback.correctAnswer}</p>
                    <p>你的输入: {feedback.userInput || '(空)'}</p>
                    {feedback.note && <p>提示: {feedback.note}</p>}
                    {feedback.masteryHint && <p>掌握进度: {feedback.masteryHint}</p>}
                    {feedback.requiresManualContinue && <p className="mt-1 font-semibold">按 Enter 继续下一单</p>}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <section className="rounded-lg border-4 border-[#4b3018] bg-[#f5e2c6] p-3 shadow-[0_5px_0_#7e5a34]">
                  <h2 className="text-lg font-semibold text-[#2f2012]">今日任务</h2>
                  <div className="mt-3 space-y-2 text-sm text-[#3e2b19]">
                    <p>
                      新增掌握词: {progress.newMastered} / {goal.newMasteredTarget}
                    </p>
                    <div className="h-3 rounded bg-[#d9bf9e]">
                      <div className="h-3 rounded bg-[#4a9a61]" style={{ width: `${masteredPct}%` }} />
                    </div>
                    <p className="text-xs text-[#5f4329]">注: 新增掌握词按 masteryLevel 3 统计。</p>
                    <p>
                      纠正错词: {progress.correctedMistakes} / {goal.correctedMistakesTarget}
                    </p>
                    <div className="h-3 rounded bg-[#d9bf9e]">
                      <div className="h-3 rounded bg-[#3f7dc7]" style={{ width: `${correctedPct}%` }} />
                    </div>
                    <p>已服务: {progress.servedOrders}</p>
                  </div>
                </section>

                <section className="rounded-lg border-4 border-[#4b3018] bg-[#f5e2c6] p-3 shadow-[0_5px_0_#7e5a34]">
                  <h2 className="text-lg font-semibold text-[#2f2012]">计划看板</h2>
                  <div className="mt-2 text-sm text-[#3e2b19]">
                    <p>总计划天数: {settings.planDays}</p>
                    <p>剩余天数: {planDaysLeft}</p>
                    <p>词池规模: {planPoolSize}</p>
                    <p>剩余未掌握词: {remainingUnmastered}</p>
                  </div>
                </section>

                <section className="rounded-lg border-4 border-[#4b3018] bg-[#f5e2c6] p-3 shadow-[0_5px_0_#7e5a34]">
                  <h2 className="text-lg font-semibold text-[#2f2012]">店铺状态</h2>
                  <div className="mt-2 text-sm text-[#3e2b19]">
                    <p>满意度: {satisfaction.current}</p>
                    <div className="mt-1 h-3 rounded bg-[#dcc5a8]">
                      <div
                        className="h-3 rounded bg-[#d1843f]"
                        style={{ width: `${Math.round((satisfaction.current / satisfaction.max) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2">金币: {coins.balance}（今日 +{coins.earnedToday}）</p>
                    <p className="mt-1">当前案板: {activeSkin ? `${activeSkin.emoji} ${activeSkin.name}` : '未设置'}</p>
                  </div>
                </section>

                <section className="rounded-lg border-4 border-[#4b3018] bg-[#f5e2c6] p-3 text-xs text-[#3f2b19] shadow-[0_5px_0_#7e5a34]">
                  <p>学习系统与经营系统解耦：</p>
                  <p>掌握判定由答题与复习决定，满意度仅影响金币收益。</p>
                  <p>今日答题记录: {answers.length} 条</p>
                </section>
              </aside>
            </div>
          )}

          {phase === 'day_summary' && (
            <section className="rounded-lg border-4 border-[#4b3018] bg-[#fff2df] p-6 shadow-[0_5px_0_#7e5a34]">
              <div className="space-y-4 text-center">
                <h2 className="text-3xl font-heading text-[#2f2012]">今日收摊</h2>
                <p className="text-[#3e2a18]">当日学习任务已完成，肉铺评价稳定。</p>
                <div className="mx-auto max-w-md rounded border-2 border-[#7a5c3a] bg-[#fff6e7] p-3 text-left text-sm text-[#3a2918]">
                  <p>新增掌握词: {progress.newMastered}</p>
                  <p>纠正错词: {progress.correctedMistakes}</p>
                  <p>今日准确率: {accuracy}%</p>
                  <p>当日金币收入: {coins.earnedToday}</p>
                </div>

                <div className="mx-auto max-w-md rounded border-2 border-[#7a5c3a] bg-[#fff6e7] p-3 text-left text-sm text-[#3a2918]">
                  <p className="mb-2 font-semibold">调整下一阶段学习计划</p>
                  <label className="block text-xs text-[#5a3f27]">
                    剩余天数（次日生效）
                    <input
                      type="number"
                      min={1}
                      value={nextPlanDays}
                      onChange={(event) => setNextPlanDays(Math.max(1, Number(event.target.value) || 1))}
                      className="mt-1 block w-full rounded border border-[#8b6944] bg-white p-2 text-sm"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => applyPlanAdjustmentAndStartNextDay(nextPlanDays)}
                    className="rounded border-4 border-[#244e31] bg-[#3d8f54] px-6 py-2 text-white shadow-[0_4px_0_#1f3f2a]"
                  >
                    应用计划并开启新营业日
                  </button>
                  <button
                    type="button"
                    onClick={() => startBusinessDay()}
                    className="rounded border-4 border-[#69431f] bg-[#b97531] px-6 py-2 text-white shadow-[0_4px_0_#633814]"
                  >
                    保持计划直接开店
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
