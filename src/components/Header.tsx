import { Download, FileDown, FolderOpen, Play, Redo2, RotateCcw, Sigma, Square, Undo2 } from 'lucide-react';
import { useRef } from 'react';
import { useDiagnostics } from '../diagnostics';
import { downloadModelFile, parseModelFile } from '../modelFile';
import { useStore } from '../store';

export function Header() {
  const name = useStore((s) => s.model.name);
  const description = useStore((s) => s.model.description);
  const dirty = useStore((s) => s.dirty);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const testMode = useStore((s) => s.testMode);
  const { undo, redo, save, toggleTest, reset, showToast, setRightTab, importModel } = useStore.getState();
  const diag = useDiagnostics();
  const fileInput = useRef<HTMLInputElement>(null);

  const onImportFile = async (file: File) => {
    try {
      const model = parseModelFile(await file.text());
      if (useStore.getState().dirty && !window.confirm('Replace the current model with the one in this file? Unsaved changes can still be undone.')) return;
      importModel(model);
      showToast(`Opened "${model.name}". Click Save to keep it in this browser.`);
    } catch (err) {
      showToast(`Could not open the file: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };


  const onExport = async () => {
    if (!diag.expr) {
      setRightTab('preview');
      showToast(`Can't export yet: ${diag.errors[0]?.message ?? 'the model has errors.'}`, 'error');
      return;
    }
    if (diag.resultError) {
      setRightTab('preview');
      showToast(`Can't export yet: ${diag.resultError} Check the sample values.`, 'error');
      return;
    }
    try {
      // Loaded on demand: the Excel library is most of the bundle.
      const { downloadXlsx } = await import('../exportXlsx');
      await downloadXlsx(useStore.getState().model);
      showToast('Exported to Excel.');
    } catch (err) {
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  return (
    <header className="header">
      <div className="header__brand">
        <div className="logo">
          <Sigma size={22} strokeWidth={2.25} />
        </div>
        <div className="header__divider" />
        <div>
          <div className="header__title">
            <h1>{name || 'Untitled model'}</h1>
            <span className={`badge ${dirty ? '' : 'badge--saved'}`}>{dirty ? 'Draft' : 'Saved'}</span>
          </div>
          <p className="header__desc">{description}</p>
        </div>
      </div>
      <div className="header__actions">
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // Allow reopening the same file later.
            if (file) void onImportFile(file);
          }}
        />
        <button className="icon-btn icon-btn--boxed" title="Open a model file (.json)" onClick={() => fileInput.current?.click()}>
          <FolderOpen size={18} />
        </button>
        <button
          className="icon-btn icon-btn--boxed"
          title="Download this model as a file to share (.json)"
          onClick={() => downloadModelFile(useStore.getState().model)}
        >
          <FileDown size={18} />
        </button>
        <button
          className="icon-btn icon-btn--boxed"
          title="Reset to the default template"
          onClick={() => window.confirm('Replace the current model with the default template? You can undo this.') && reset()}
        >
          <RotateCcw size={16} />
        </button>
        <span className="header__spacer" />
        <button className="icon-btn icon-btn--boxed" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={18} />
        </button>
        <button className="icon-btn icon-btn--boxed" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={18} />
        </button>
        <button className={`btn btn--secondary ${testMode ? 'is-active' : ''}`} onClick={toggleTest} title="Show sample-value results on every node">
          {testMode ? <Square size={14} /> : <Play size={16} />} {testMode ? 'Stop test' : 'Test'}
        </button>
        <button className="btn btn--secondary" onClick={onExport} title="Download an Excel workbook with the live formula">
          <Download size={16} /> Export XLSX
        </button>
        <button className="btn btn--primary" onClick={save} title="Save in this browser (Ctrl+S)">
          Save
        </button>
      </div>
    </header>
  );
}
