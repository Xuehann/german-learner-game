import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { ImportResult } from '../types';

interface JsonImportPanelProps {
  report: ImportResult | null;
  onImport: (text: string) => void;
  onClearReport: () => void;
}

export const JsonImportPanel = ({ report, onImport, onClearReport }: JsonImportPanelProps) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    onImport(text);

    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-butcher-wood/25 bg-white/85 p-4 shadow-board">
      <h2 className="font-heading text-xl text-butcher-deep">上传词库 JSON</h2>
      <p className="mt-2 text-sm text-butcher-deep/80">
        必填字段: <code>id</code>, <code>english</code>, <code>german</code>, <code>category</code>, <code>difficulty</code>
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleUpload}
        className="mt-3 block w-full rounded-lg border border-butcher-wood/30 bg-white p-2 text-sm"
      />

      {report && (
        <div className="mt-4 rounded-lg border border-butcher-wood/30 bg-butcher-cream/60 p-3 text-sm">
          {report.errors.length === 0 ? (
            <p className="font-medium text-butcher-green">导入成功，新增/覆盖 {report.addedWords} 个单词。</p>
          ) : (
            <>
              <p className="font-medium text-butcher-red">导入失败，共 {report.errors.length} 个问题：</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-butcher-deep">
                {report.errors.slice(0, 6).map((error) => (
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
