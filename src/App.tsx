import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { JsonImportPanel } from './components/JsonImportPanel';
import { ALT_CHAR_MAP } from './lib/germanInput';
import {
  dayGoalDefault,
  difficultyOptions,
  getDayAccuracy,
  SAUSAGE_CATALOG,
  useGameStore
} from './store/gameStore';
import type { Order, OrderType } from './types';

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  translation: '标准翻译单',
  review: '错词回炉单',
  combo: '组合连单'
};

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

function App() {
  const {
    isInitialized,
    phase,
    businessDay,
    orderQueue,
    currentOrder,
    currentInput,
    feedback,
    settings,
    importReport,
    satisfaction,
    coins,
    collection,
    answers,
    initializeGame,
    startBusinessDay,
    setInput,
    appendSpecialChar,
    submitOrderAnswer,
    skipOrder,
    continueAfterFeedback,
    updateSettings,
    importWordsFromJsonText,
    clearImportReport,
    redeemSausage,
    setDisplaySausage
  } = useGameStore();

  const [showHint, setShowHint] = useState(false);
  const [cutAnimTick, setCutAnimTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const accuracy = getDayAccuracy(businessDay?.progress ?? null);

  const goal = businessDay?.goal ?? dayGoalDefault;
  const progress = businessDay?.progress ?? {
    newMastered: 0,
    correctedMistakes: 0,
    servedOrders: 0,
    correctOrders: 0
  };

  const masteredPct = Math.min(100, Math.round((progress.newMastered / goal.newMasteredTarget) * 100));
  const correctedPct = Math.min(100, Math.round((progress.correctedMistakes / goal.correctedMistakesTarget) * 100));

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

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
  }, [continueAfterFeedback, feedback?.type, phase, settings.feedbackDelayMs]);

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
  }, [continueAfterFeedback, feedback?.type, phase]);

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

  const activeSkin = SAUSAGE_CATALOG.find((skin) => skin.id === collection.displaySkinId) ?? null;

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-2xl border-4 border-[#3b2c20] bg-[#c8a079] p-2 shadow-[0_10px_0_#2f2117]">
        <div className="rounded-xl border-4 border-[#6f4c2d] bg-[linear-gradient(135deg,#e5c9a5_0%,#dcb98e_45%,#cfa678_100%)] p-4 sm:p-5">
          <header className="mb-4 rounded-lg border-4 border-[#4e341e] bg-[#f2ddbf] p-3 shadow-[0_4px_0_#7f5c39]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-heading text-2xl text-[#2d1f12] sm:text-3xl">德语学习</h1>
                <p className="text-sm text-[#4e341e]">德国肉铺营业中：顾客接单、答题出餐、完成当日学习任务</p>
              </div>
              <div className="rounded-md border-2 border-[#6a4a2b] bg-[#fff5e6] px-3 py-2 text-sm text-[#3b2918]">
                <p>当日目标: 掌握 {goal.newMasteredTarget} · 纠错 {goal.correctedMistakesTarget}</p>
                <p>今日准确率: {accuracy}% · 已服务 {progress.servedOrders} 单</p>
              </div>
            </div>
          </header>

          <div className="grid gap-4 lg:grid-cols-[1.05fr_1.6fr_1.2fr]">
            <section className="rounded-lg border-4 border-[#4b3018] bg-[#f8e5ca] p-3 shadow-[0_5px_0_#7e5a34]">
              <h2 className="mb-2 text-lg font-semibold text-[#2f2114]">顾客队列</h2>
              <div className="space-y-2">
                {orderQueue.map((order, idx) => (
                  <article
                    key={order.id}
                    className={`rounded border-2 px-3 py-2 text-sm ${
                      idx === 0
                        ? 'border-[#2f6f3f] bg-[#e8ffd9]'
                        : 'border-[#8a6640] bg-[#fff4e4]'
                    }`}
                  >
                    <p className="font-semibold text-[#3a2817]">
                      {order.customer.avatar} {order.customer.name}
                    </p>
                    <p className="text-xs text-[#5b4128]">{ORDER_TYPE_LABEL[order.type]}</p>
                    <p className="mt-1 text-xs text-[#3f2c1b]">{order.prompt}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-lg border-4 border-[#4b3018] bg-[#fbe9cf] p-4 shadow-[0_5px_0_#7e5a34]">
              {phase === 'day_summary' ? (
              <div className="space-y-4 py-6 text-center">
                  <h2 className="text-3xl font-heading text-[#2f2012]">今日收摊</h2>
                  <p className="text-[#3e2a18]">当日学习任务已完成，肉铺评价稳定。</p>
                  <div className="mx-auto max-w-md rounded border-2 border-[#7a5c3a] bg-[#fff6e7] p-3 text-left text-sm text-[#3a2918]">
                    <p>新增掌握词: {progress.newMastered}</p>
                    <p>纠正错词: {progress.correctedMistakes}</p>
                    <p>今日准确率: {accuracy}%</p>
                    <p>当日金币收入: {coins.earnedToday}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startBusinessDay()}
                    className="rounded border-4 border-[#244e31] bg-[#3d8f54] px-6 py-2 text-white shadow-[0_4px_0_#1f3f2a]"
                  >
                    开启新营业日
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3 rounded border-2 border-[#7d5a37] bg-[#fff6e7] p-3">
                    <p className="text-xs uppercase tracking-wide text-[#6a4a2d]">当前订单</p>
                    <p className="mt-1 text-lg font-semibold text-[#2f2012]">{currentOrder?.prompt ?? '等待顾客...'}</p>
                    <p className="text-sm text-[#5b4128]">{currentOrder?.instruction ?? ''}</p>
                  </div>

                  <div className="mb-3 rounded border-2 border-[#7d5a37] bg-[#fff6e7] p-3">
                    <p className="text-xs uppercase tracking-wide text-[#6a4a2d]">出餐工作台</p>
                    <div className="relative mt-2 h-24 overflow-hidden rounded border border-[#8f6a43] bg-[linear-gradient(180deg,#f8e7cf_0%,#e8c6a0_100%)]">
                      <motion.div
                        key={`knife-${cutAnimTick}`}
                        className="absolute right-7 top-0 h-11 w-2 origin-top rounded bg-[#3a3a3a]"
                        initial={{ y: -28, rotate: -28 }}
                        animate={
                          feedback?.type === 'correct'
                            ? { y: [ -28, 18, 18 ], rotate: [ -28, -8, -8 ] }
                            : { y: -28, rotate: -28 }
                        }
                        transition={{ duration: 1.2, ease: 'easeInOut' }}
                      />
                      <motion.div
                        key={`left-${cutAnimTick}`}
                        className="absolute left-[calc(50%-76px)] top-[46px] h-7 w-16 rounded-l-xl border-2 border-[#7a3c24] bg-[#c96f43]"
                        initial={{ x: 0, rotate: 0 }}
                        animate={feedback?.type === 'correct' ? { x: -26, rotate: -10 } : { x: 0, rotate: 0 }}
                        transition={{ duration: 1.2, ease: 'easeInOut' }}
                      />
                      <motion.div
                        key={`right-${cutAnimTick}`}
                        className="absolute left-[calc(50%-8px)] top-[46px] h-7 w-16 rounded-r-xl border-2 border-[#7a3c24] bg-[#be6438]"
                        initial={{ x: 0, rotate: 0 }}
                        animate={feedback?.type === 'correct' ? { x: 26, rotate: 10 } : { x: 0, rotate: 0 }}
                        transition={{ duration: 1.2, ease: 'easeInOut' }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#6a4a2d]">答对后触发成功切割动画（1.2 秒）</p>
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
                    <p className="text-xs text-[#5f4329]">快捷键: Alt+A/O/U/S {'->'} ä/ö/ü/ß（移动端请用系统键盘长按）</p>

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
                      <p className="font-semibold">{feedback.title}</p>
                      <p>正确答案: {feedback.correctAnswer}</p>
                      <p>你的输入: {feedback.userInput || '(空)'}</p>
                      {feedback.note && <p>提示: {feedback.note}</p>}
                      {feedback.requiresManualContinue && <p className="mt-1 font-semibold">按 Enter 继续下一单</p>}
                    </div>
                  )}
                </>
              )}
            </section>

            <aside className="space-y-4">
              <section className="rounded-lg border-4 border-[#4b3018] bg-[#f5e2c6] p-3 shadow-[0_5px_0_#7e5a34]">
                <h2 className="text-lg font-semibold text-[#2f2012]">当日任务</h2>
                <div className="mt-3 space-y-2 text-sm text-[#3e2b19]">
                  <p>新增掌握词: {progress.newMastered} / {goal.newMasteredTarget}</p>
                  <div className="h-3 rounded bg-[#d9bf9e]">
                    <div className="h-3 rounded bg-[#4a9a61]" style={{ width: `${masteredPct}%` }} />
                  </div>
                  <p>纠正错词: {progress.correctedMistakes} / {goal.correctedMistakesTarget}</p>
                  <div className="h-3 rounded bg-[#d9bf9e]">
                    <div className="h-3 rounded bg-[#3f7dc7]" style={{ width: `${correctedPct}%` }} />
                  </div>
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
                </div>
              </section>

              <section className="rounded-lg border-4 border-[#4b3018] bg-[#f5e2c6] p-3 shadow-[0_5px_0_#7e5a34]">
                <h2 className="text-lg font-semibold text-[#2f2012]">香肠收藏</h2>
                <p className="mt-1 text-sm text-[#3e2b19]">
                  当前陈列: {activeSkin ? `${activeSkin.emoji} ${activeSkin.name}` : '未设置'}
                </p>
                <p className="mt-1 text-xs text-[#5a3f27]">通过金币商店兑换，不再随机掉落。</p>
                <div className="mt-3 grid gap-2">
                  {SAUSAGE_CATALOG.map((skin) => {
                    const owned = collection.ownedSkinIds.includes(skin.id);
                    return (
                      <div key={skin.id} className="rounded border-2 border-[#8a6540] bg-[#fff6e8] p-2 text-xs text-[#3f2b19]">
                        <p className="font-semibold">{skin.emoji} {skin.name}</p>
                        <p>{skin.description}</p>
                        <p>稀有度: {skin.rarity} · 价格: {skin.price}</p>
                        {owned ? (
                          <button
                            type="button"
                            onClick={() => setDisplaySausage(skin.id)}
                            className="mt-1 rounded border border-[#335f3e] bg-[#e7ffdc] px-2 py-1"
                          >
                            设为陈列
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => redeemSausage(skin.id)}
                            disabled={coins.balance < skin.price}
                            className="mt-1 rounded border border-[#6b4b29] bg-[#ffe1b9] px-2 py-1 disabled:opacity-45"
                          >
                            金币兑换
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-lg border-4 border-[#4b3018] bg-[#f5e2c6] p-3 shadow-[0_5px_0_#7e5a34]">
                <h2 className="text-lg font-semibold text-[#2f2012]">经营设置</h2>
                <div className="mt-2 space-y-2 text-sm text-[#3e2b19]">
                  <label className="block">
                    难度
                    <select
                      className="mt-1 block w-full rounded border border-[#8b6944] bg-white p-2"
                      value={settings.difficulty}
                      onChange={(event) =>
                        updateSettings({ difficulty: event.target.value as typeof settings.difficulty })
                      }
                    >
                      {difficultyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <JsonImportPanel
                report={importReport}
                onImport={importWordsFromJsonText}
                onClearReport={clearImportReport}
              />

              <section className="rounded-lg border-4 border-[#4b3018] bg-[#f5e2c6] p-3 text-xs text-[#3f2b19] shadow-[0_5px_0_#7e5a34]">
                <p>学习系统与经营系统解耦：</p>
                <p>掌握判定只由答题/复习决定，满意度仅影响金币收益。</p>
                <p>今日答题记录: {answers.length} 条</p>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
