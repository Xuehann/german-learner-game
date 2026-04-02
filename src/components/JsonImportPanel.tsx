import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { AIGeneratedUnitDraft, ImportResult } from '../types';

interface JsonImportPanelProps {
  report: ImportResult | null;
  onImport: (text: string, unitName?: string) => void;
  onClearReport: () => void;
  onGenerateFromText: (rawText: string, unitName?: string) => Promise<void>;
  onSaveGeneratedDraft: (unitName?: string) => void;
  onClearGeneratedDraft: () => void;
  generatedDraft: AIGeneratedUnitDraft | null;
  aiState: 'idle' | 'loading' | 'error' | 'ready';
  aiError: string | null;
}

const normalizeUnitName = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const basenameWithoutExt = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) {
    return '新单元';
  }

  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0) {
    return trimmed;
  }

  return trimmed.slice(0, dot);
};

export const JsonImportPanel = ({
  report,
  onImport,
  onClearReport,
  onGenerateFromText,
  onSaveGeneratedDraft,
  onClearGeneratedDraft,
  generatedDraft,
  aiState,
  aiError
}: JsonImportPanelProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [jsonUnitName, setJsonUnitName] = useState('');
  const [aiUnitName, setAiUnitName] = useState('');
  const [rawWordList, setRawWordList] = useState('');
  const [wordSearch, setWordSearch] = useState('');

  useEffect(() => {
    if (!generatedDraft) {
      return;
    }

    setAiUnitName((prev) => prev.trim() || generatedDraft.suggestedUnitName || prev);
  }, [generatedDraft]);

  const filteredPreview = useMemo(() => {
    if (!generatedDraft) {
      return [];
    }

    const keyword = wordSearch.trim().toLowerCase();
    if (!keyword) {
      return generatedDraft.words;
    }

    return generatedDraft.words.filter((word) => {
      return (
        word.english.toLowerCase().includes(keyword) ||
        word.german.toLowerCase().includes(keyword) ||
        word.category.toLowerCase().includes(keyword)
      );
    });
  }, [generatedDraft, wordSearch]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const inferredName = basenameWithoutExt(file.name);

    onImport(text, normalizeUnitName(jsonUnitName) ?? inferredName);

    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!rawWordList.trim()) {
      return;
    }

    await onGenerateFromText(rawWordList, normalizeUnitName(aiUnitName));
  };

  const handleSaveDraft = () => {
    onSaveGeneratedDraft(normalizeUnitName(aiUnitName));
    setRawWordList('');
    setWordSearch('');
  };

  return (
    <section className="rounded-2xl border border-butcher-wood/25 bg-white/85 p-4 shadow-board">
      <h2 className="font-heading text-xl text-butcher-deep">词库导入与 AI 生成</h2>

      <div className="mt-3 rounded-lg border border-butcher-wood/25 bg-white p-3">
        <p className="text-sm font-semibold text-butcher-deep">JSON 上传创建新单元</p>
        <p className="mt-1 text-xs text-butcher-deep/70">
          必填字段: <code>id</code>, <code>english</code>, <code>german</code>, <code>category</code>
        </p>
        <p className="mt-1 text-xs text-butcher-deep/70">
          可选字段: <code>pastTense</code>；若包含历史字段 <code>difficulty</code> 将自动忽略。
        </p>
        <label className="mt-2 block text-xs text-butcher-deep/70">
          单元名称（可选）
          <input
            type="text"
            value={jsonUnitName}
            onChange={(event) => setJsonUnitName(event.target.value)}
            placeholder="例如：餐厅德语第1课"
            className="mt-1 block w-full rounded-lg border border-butcher-wood/30 bg-white p-2 text-sm"
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleUpload}
          className="mt-2 block w-full rounded-lg border border-butcher-wood/30 bg-white p-2 text-sm"
        />
      </div>

      <div className="mt-4 rounded-lg border border-butcher-wood/25 bg-white p-3">
        <p className="text-sm font-semibold text-butcher-deep">AI 词表生成新单元</p>
        <p className="mt-1 text-xs text-butcher-deep/70">
          粘贴词表文本（中英混排也可），系统会通过后端代理生成标准词库并预览。
        </p>
        <label className="mt-2 block text-xs text-butcher-deep/70">
          单元名称（可选）
          <input
            type="text"
            value={aiUnitName}
            onChange={(event) => setAiUnitName(event.target.value)}
            placeholder="例如：医院常用德语"
            className="mt-1 block w-full rounded-lg border border-butcher-wood/30 bg-white p-2 text-sm"
          />
        </label>
        <label className="mt-2 block text-xs text-butcher-deep/70">
          原始词表文本
          <textarea
            value={rawWordList}
            onChange={(event) => setRawWordList(event.target.value)}
            rows={5}
            placeholder={'apple - der Apfel\nbook - das Buch\nwater - das Wasser'}
            className="mt-1 block w-full rounded-lg border border-butcher-wood/30 bg-white p-2 text-sm"
          />
        </label>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={aiState === 'loading' || !rawWordList.trim()}
            className="rounded-lg border border-butcher-wood/40 bg-[#ffe8c8] px-3 py-1.5 text-xs font-medium text-butcher-deep disabled:opacity-50"
          >
            {aiState === 'loading' ? 'AI 生成中...' : 'AI 生成预览'}
          </button>
          {generatedDraft && (
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-lg border border-butcher-green/40 bg-[#e7ffdc] px-3 py-1.5 text-xs font-medium text-butcher-green"
            >
              保存为学习单元
            </button>
          )}
          {generatedDraft && (
            <button
              type="button"
              onClick={onClearGeneratedDraft}
              className="rounded-lg border border-butcher-wood/40 bg-white px-3 py-1.5 text-xs font-medium text-butcher-deep"
            >
              清除预览
            </button>
          )}
        </div>

        {aiError && (
          <p className="mt-2 rounded border border-butcher-red/40 bg-red-50 px-2 py-1 text-xs text-butcher-red">
            {aiError}
          </p>
        )}

        {generatedDraft && (
          <div className="mt-3 rounded-lg border border-butcher-wood/25 bg-butcher-cream/40 p-2">
            <p className="text-xs text-butcher-deep/80">
              预览单元: <span className="font-semibold">{generatedDraft.suggestedUnitName}</span> · {generatedDraft.words.length} 词
            </p>
            <input
              type="text"
              value={wordSearch}
              onChange={(event) => setWordSearch(event.target.value)}
              placeholder="搜索单词"
              className="mt-2 block w-full rounded border border-butcher-wood/30 bg-white p-1.5 text-xs"
            />
            <div className="mt-2 max-h-40 overflow-auto rounded border border-butcher-wood/20 bg-white text-xs">
              {filteredPreview.slice(0, 80).map((word) => (
                <div key={word.id} className="border-b border-butcher-wood/10 px-2 py-1 last:border-b-0">
                  <span className="font-medium">{word.english}</span> {'->'} {word.german}
                  <span className="ml-1 text-butcher-deep/60">({word.category})</span>
                </div>
              ))}
              {filteredPreview.length === 0 && <p className="px-2 py-2 text-butcher-deep/70">没有匹配词条</p>}
            </div>
          </div>
        )}
      </div>

      {report && (
        <div className="mt-4 rounded-lg border border-butcher-wood/30 bg-butcher-cream/60 p-3 text-sm">
          {report.errors.length === 0 ? (
            <p className="font-medium text-butcher-green">
              {report.message ?? `导入成功，新增 ${report.addedWords} 个单词。`}
            </p>
          ) : (
            <>
              <p className="font-medium text-butcher-red">导入失败，共 {report.errors.length} 个问题：</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-butcher-deep">
                {report.errors.slice(0, 8).map((error) => (
                  <li key={`${error.index}-${error.field}`}>
                    第 {error.index + 1} 项 {error.field}: {error.message}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={onClearReport}
            className="mt-3 rounded-lg border border-butcher-wood/40 bg-white px-3 py-1.5 text-xs font-medium text-butcher-deep"
          >
            关闭
          </button>
        </div>
      )}
    </section>
  );
};
