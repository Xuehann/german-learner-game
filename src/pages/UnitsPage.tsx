import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { JsonImportPanel } from '../components/JsonImportPanel';
import { useGameStore } from '../store/gameStore';
import type { LearningUnit, Word } from '../types';

export function UnitsPage() {
  const {
    isInitialized,
    learningUnits,
    unitWordsMap,
    activeUnitId,
    importReport,
    aiDraft,
    aiState,
    aiError,
    importWordsFromJsonText,
    generateWordsFromText,
    saveGeneratedDraft,
    clearGeneratedDraft,
    clearImportReport,
    setActiveLearningUnit,
    renameLearningUnit,
    deleteLearningUnit
  } = useGameStore();

  const [unitSearch, setUnitSearch] = useState('');
  const [renamingUnitId, setRenamingUnitId] = useState<string | null>(null);
  const [renamingUnitName, setRenamingUnitName] = useState('');

  const activeUnit = learningUnits.find((unit) => unit.id === activeUnitId) ?? null;
  const activeUnitWords = useMemo<Word[]>(() => {
    if (!activeUnitId) {
      return [];
    }

    return unitWordsMap[activeUnitId] ?? [];
  }, [activeUnitId, unitWordsMap]);

  const filteredActiveUnitWords = useMemo<Word[]>(() => {
    if (!activeUnit) {
      return [];
    }

    const normalized = unitSearch.trim().toLowerCase();
    if (!normalized) {
      return activeUnitWords;
    }

    return activeUnitWords.filter((word) => {
      return (
        word.english.toLowerCase().includes(normalized) ||
        word.german.toLowerCase().includes(normalized) ||
        word.category.toLowerCase().includes(normalized)
      );
    });
  }, [activeUnit, activeUnitWords, unitSearch]);

  const startRename = (unit: LearningUnit) => {
    setRenamingUnitId(unit.id);
    setRenamingUnitName(unit.name);
  };

  const submitRename = () => {
    if (!renamingUnitId) {
      return;
    }

    const next = renamingUnitName.trim();
    if (!next) {
      return;
    }

    renameLearningUnit(renamingUnitId, next);
    setRenamingUnitId(null);
    setRenamingUnitName('');
  };

  const removeUnit = (unit: LearningUnit) => {
    const ok = window.confirm(`确认删除学习单元“${unit.name}”？该单元词条进度会一起删除。`);
    if (!ok) {
      return;
    }

    deleteLearningUnit(unit.id);
    if (renamingUnitId === unit.id) {
      setRenamingUnitId(null);
      setRenamingUnitName('');
    }
  };

  if (!isInitialized) {
    return <div className="p-6 text-center text-butcher-deep">正在准备词库中心...</div>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-2xl border-4 border-[#3b2c20] bg-[#c8a079] p-2 shadow-[0_10px_0_#2f2117]">
        <div className="rounded-xl border-4 border-[#6f4c2d] bg-[linear-gradient(135deg,#e5c9a5_0%,#dcb98e_45%,#cfa678_100%)] p-4 sm:p-5">
          <header className="mb-4 rounded-lg border-4 border-[#4e341e] bg-[#f2ddbf] p-3 shadow-[0_4px_0_#7f5c39]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-heading text-2xl text-[#2d1f12] sm:text-3xl">词库中心</h1>
                <p className="text-sm text-[#4e341e]">管理学习单元、导入 JSON、AI 生成词库</p>
              </div>
              <div className="rounded-md border-2 border-[#6a4a2b] bg-[#fff5e6] px-3 py-2 text-xs text-[#3b2918]">
                <p>当前单元: {activeUnit ? activeUnit.name : '试玩词池（内置）'}</p>
                <p>单元数量: {learningUnits.length}</p>
                <Link
                  to="/"
                  className="mt-2 inline-block rounded border border-[#5e4429] bg-[#fff0da] px-2 py-1 text-xs text-[#3b2918]"
                >
                  返回营业台
                </Link>
              </div>
            </div>
          </header>

          <section className="mb-4 rounded-lg border-4 border-[#4b3018] bg-[#fff5e8] p-4 text-[#2f2012] shadow-[0_5px_0_#7e5a34]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-2xl">学习单元</h2>
              <p className="text-xs text-[#5a3f27]">上传 JSON 或 AI 生成都会创建新单元并自动切换。</p>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded border-2 border-[#7a5c3a] bg-[#fffdf7] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">单元列表</p>
                </div>

                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {learningUnits.length === 0 && (
                    <p className="rounded border border-dashed border-[#9a7a54] bg-[#fff8ee] px-2 py-2 text-xs text-[#5a3f27]">
                      还没有学习单元，先在下方导入词库。
                    </p>
                  )}

                  {learningUnits.map((unit) => {
                    const isActive = unit.id === activeUnitId;
                    const isRenaming = unit.id === renamingUnitId;
                    return (
                      <article key={unit.id} className="rounded border border-[#8a6540] bg-white p-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#2f2012]">{unit.name}</p>
                            <p className="text-[#5a3f27]">
                              {unit.wordCount} 词 · 创建于 {new Date(unit.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`rounded px-2 py-0.5 ${
                              isActive ? 'bg-[#dff8d4] text-[#224a2e]' : 'bg-[#f2e3cf] text-[#5a3f27]'
                            }`}
                          >
                            {isActive ? '当前' : '可切换'}
                          </span>
                        </div>

                        {isRenaming ? (
                          <div className="mt-2 flex gap-1">
                            <input
                              type="text"
                              value={renamingUnitName}
                              onChange={(event) => setRenamingUnitName(event.target.value)}
                              className="min-w-0 flex-1 rounded border border-[#8b6944] px-2 py-1"
                            />
                            <button
                              type="button"
                              onClick={submitRename}
                              className="rounded border border-[#335f3e] bg-[#e6f6dd] px-2 py-1"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingUnitId(null);
                                setRenamingUnitName('');
                              }}
                              className="rounded border border-[#8a6540] bg-white px-2 py-1"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {!isActive && (
                              <button
                                type="button"
                                onClick={() => setActiveLearningUnit(unit.id)}
                                className="rounded border border-[#335f3e] bg-[#e6f6dd] px-2 py-1"
                              >
                                切换
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startRename(unit)}
                              className="rounded border border-[#8a6540] bg-white px-2 py-1"
                            >
                              重命名
                            </button>
                            <button
                              type="button"
                              onClick={() => removeUnit(unit)}
                              className="rounded border border-[#8e3d2f] bg-[#ffe7e1] px-2 py-1 text-[#7d261a]"
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="rounded border-2 border-[#7a5c3a] bg-[#fffdf7] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{activeUnit ? `单元词表: ${activeUnit.name}` : '试玩词池说明'}</p>
                  {activeUnit && (
                    <input
                      type="text"
                      value={unitSearch}
                      onChange={(event) => setUnitSearch(event.target.value)}
                      placeholder="搜索词表"
                      className="rounded border border-[#8b6944] bg-white px-2 py-1 text-xs"
                    />
                  )}
                </div>

                {activeUnit ? (
                  <div className="mt-2 max-h-64 overflow-auto rounded border border-[#ead7bd] bg-white text-xs">
                    {filteredActiveUnitWords.map((word) => (
                      <div key={word.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-[#f1e4d2] px-2 py-1 last:border-b-0">
                        <span>{word.english}</span>
                        <span>{word.german}</span>
                        <span className="text-[#5a3f27]">{word.category}</span>
                      </div>
                    ))}
                    {filteredActiveUnitWords.length === 0 && (
                      <p className="px-2 py-2 text-[#5a3f27]">没有匹配词条</p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 rounded border border-dashed border-[#9a7a54] bg-[#fff8ee] p-3 text-xs text-[#5a3f27]">
                    没有激活学习单元时，系统会自动回退到内置试玩词池。
                  </div>
                )}
              </div>
            </div>
          </section>

          <JsonImportPanel
            report={importReport}
            onImport={importWordsFromJsonText}
            onGenerateFromText={generateWordsFromText}
            onSaveGeneratedDraft={saveGeneratedDraft}
            onClearGeneratedDraft={clearGeneratedDraft}
            generatedDraft={aiDraft}
            aiState={aiState}
            aiError={aiError}
            onClearReport={clearImportReport}
          />
        </div>
      </div>
    </main>
  );
}
