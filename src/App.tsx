import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { JsonImportPanel } from './components/JsonImportPanel';
import { SausageDisplay } from './components/SausageDisplay';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { buildHint } from './lib/answer';
import { ALT_CHAR_MAP, applyGermanAutoReplace } from './lib/germanInput';
import { difficultyOptions, getAccuracy, getCurrentWord, useGameStore } from './store/gameStore';

const CUT_ANIMATION_MS = 1200;

const feedbackClassMap = {
  correct: 'border-butcher-green/40 bg-green-50 text-butcher-green',
  wrong: 'border-butcher-red/40 bg-red-50 text-butcher-red',
  skip: 'border-butcher-wood/40 bg-amber-50 text-butcher-deep'
} as const;

function App() {
  const {
    isInitialized,
    session,
    phase,
    feedback,
    currentInput,
    settings,
    importReport,
    initializeGame,
    setInput,
    appendSpecialChar,
    submitAnswer,
    skipWord,
    nextWord,
    startSession,
    updateSettings,
    importWordsFromJsonText,
    clearImportReport
  } = useGameStore();

  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentWord = useMemo(() => getCurrentWord(session), [session]);
  const accuracy = getAccuracy(session);
  const progressLabel = session
    ? `${Math.min(session.currentWordIndex + 1, session.wordsInSession.length)}/${session.wordsInSession.length}`
    : '0/0';

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  useEffect(() => {
    setShowHint(false);
  }, [currentWord?.id]);

  useEffect(() => {
    if (phase === 'typing') {
      inputRef.current?.focus();
    }
  }, [phase, currentWord?.id]);

  useEffect(() => {
    if (phase === 'cut_success_anim') {
      const timer = window.setTimeout(() => nextWord(), CUT_ANIMATION_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'show_correct_answer' && feedback?.type !== 'wrong') {
      const timer = window.setTimeout(() => nextWord(), settings.feedbackDelayMs);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [feedback?.type, nextWord, phase, settings.feedbackDelayMs]);

  useEffect(() => {
    if (phase !== 'show_correct_answer' || feedback?.type !== 'wrong') {
      return undefined;
    }

    const handleEnterToContinue = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      nextWord();
    };

    window.addEventListener('keydown', handleEnterToContinue);
    return () => window.removeEventListener('keydown', handleEnterToContinue);
  }, [feedback?.type, nextWord, phase]);

  if (!isInitialized || !session || !currentWord) {
    return <div className="p-6 text-center text-butcher-deep">正在准备德国肉铺...</div>;
  }

  const handleInputChange = (value: string) => {
    const next = settings.autoReplace ? applyGermanAutoReplace(value) : value;
    setInput(next);
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

  const disabledInput = phase !== 'typing';

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-3xl bg-gradient-to-br from-butcher-cream/95 via-[#f5dcc1]/90 to-[#eed2b5]/95 p-4 shadow-board sm:p-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-butcher-wood/30 bg-white/75 p-4">
          <div>
            <h1 className="font-heading text-2xl text-butcher-deep sm:text-3xl">德语学习</h1>
            <p className="text-sm text-butcher-deep/80">先输入德语，答对后香肠才会成功切开</p>
          </div>
          <div className="text-right text-sm text-butcher-deep">
            <p>进度: <span className="font-semibold">{progressLabel}</span></p>
            <p>正确率: <span className="font-semibold">{accuracy}%</span> · 已答 {session.totalAnswers} 题</p>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-2xl border border-butcher-wood/25 bg-white/85 p-4 shadow-board sm:p-5">
            {phase === 'completed' ? (
              <div className="space-y-4 py-8 text-center">
                <h2 className="font-heading text-3xl text-butcher-deep">本轮完成</h2>
                <p className="text-lg text-butcher-deep">正确率 {accuracy}% ，共答 {session.totalAnswers} 题。</p>
                <button
                  type="button"
                  onClick={() => startSession()}
                  className="rounded-xl bg-butcher-red px-6 py-3 text-white transition hover:bg-[#9f3927]"
                >
                  开始新一轮
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-2xl bg-[#fff8ef] p-4 text-center">
                  <p className="text-sm uppercase tracking-widest text-butcher-wood/80">English Word</p>
                  <p className="mt-2 font-heading text-4xl text-butcher-deep">{currentWord.english}</p>
                </div>

                <SausageDisplay phase={phase} />

                {feedback && (
                  <div className={`mt-4 rounded-xl border p-3 ${feedbackClassMap[feedback.type]}`}>
                    <p className="font-semibold">{feedback.title}</p>
                    <p className="mt-1 text-sm">正确答案: {feedback.correctAnswer}</p>
                    <p className="text-sm">你的输入: {feedback.userInput || '(空)'}</p>
                    {feedback.note && <p className="mt-1 text-sm">提示: {feedback.note}</p>}
                    {phase === 'show_correct_answer' && feedback.type === 'wrong' && (
                      <p className="mt-2 text-sm font-semibold">按 Enter 继续下一题</p>
                    )}
                  </div>
                )}

                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitAnswer();
                  }}
                >
                  <label htmlFor="german-input" className="block text-sm font-semibold text-butcher-deep">
                    输入德语翻译
                  </label>
                  <input
                    id="german-input"
                    ref={inputRef}
                    value={currentInput}
                    onChange={(event) => handleInputChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabledInput}
                    placeholder="例如: der Apfel"
                    className="w-full rounded-xl border border-butcher-wood/35 bg-white px-4 py-3 text-lg text-butcher-deep outline-none ring-butcher-red/25 transition focus:ring disabled:cursor-not-allowed disabled:bg-stone-100"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={disabledInput}
                      className="rounded-xl bg-butcher-red px-5 py-2.5 text-white transition hover:bg-[#9f3927] disabled:cursor-not-allowed disabled:bg-stone-400"
                    >
                      提交
                    </button>
                    <button
                      type="button"
                      onClick={() => skipWord()}
                      disabled={disabledInput}
                      className="rounded-xl border border-butcher-wood/40 bg-white px-5 py-2.5 text-butcher-deep transition hover:bg-butcher-cream disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      跳过
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHint((prev) => !prev)}
                      disabled={disabledInput}
                      className="rounded-xl border border-butcher-wood/40 bg-white px-5 py-2.5 text-butcher-deep transition hover:bg-butcher-cream disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      提示
                    </button>
                  </div>
                </form>

                {showHint && (
                  <p className="mt-3 rounded-lg bg-butcher-cream/70 px-3 py-2 text-sm text-butcher-deep">
                    提示: {buildHint(currentWord.german)}
                  </p>
                )}

                <div className="mt-4 space-y-2">
                  <p className="text-xs text-butcher-deep/75">快捷键: Alt+A=ä, Alt+O=ö, Alt+U=ü, Alt+S=ß</p>
                  <VirtualKeyboard onInsert={appendSpecialChar} disabled={disabledInput} />
                </div>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-butcher-wood/25 bg-white/85 p-4 shadow-board">
              <h2 className="font-heading text-xl text-butcher-deep">本轮设置</h2>
              <div className="mt-3 space-y-3 text-sm text-butcher-deep">
                <label className="block">
                  难度
                  <select
                    className="mt-1 block w-full rounded-lg border border-butcher-wood/35 bg-white p-2"
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

                <label className="block">
                  每轮词数 (5-50)
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={settings.sessionSize}
                    onChange={(event) => updateSettings({ sessionSize: Number(event.target.value) })}
                    className="mt-1 block w-full rounded-lg border border-butcher-wood/35 bg-white p-2"
                  />
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.autoReplace}
                    onChange={(event) => updateSettings({ autoReplace: event.target.checked })}
                  />
                  启用 ae/oe/ue/ss 自动替换
                </label>

                <button
                  type="button"
                  onClick={() => startSession()}
                  className="w-full rounded-xl bg-butcher-deep px-4 py-2 text-white transition hover:bg-[#3e2413]"
                >
                  重新开始本轮
                </button>
              </div>
            </section>

            <JsonImportPanel
              report={importReport}
              onImport={importWordsFromJsonText}
              onClearReport={clearImportReport}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

export default App;
