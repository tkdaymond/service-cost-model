import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useMemo } from 'react';
import { Canvas } from './components/Canvas';
import { Header } from './components/Header';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { diagnose, DiagnosticsContext } from './diagnostics';
import { useStore } from './store';

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      const { undo, redo, save } = useStore.getState();
      if (key === 's') {
        e.preventDefault();
        save();
      } else if (!isTyping(e.target) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (!isTyping(e.target) && key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (useStore.getState().dirty) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}

export function App() {
  const fields = useStore((s) => s.model.fields);
  const nodes = useStore((s) => s.model.nodes);
  const edges = useStore((s) => s.model.edges);
  const name = useStore((s) => s.model.name);
  const description = useStore((s) => s.model.description);
  const toast = useStore((s) => s.toast);
  useShortcuts();

  // Recompile whenever the model changes. Graphs are small, so this is cheap.
  const diagnostics = useMemo(() => diagnose({ name, description, fields, nodes, edges }), [name, description, fields, nodes, edges]);

  return (
    <ReactFlowProvider>
      <DiagnosticsContext.Provider value={diagnostics}>
        <div className="app">
          <Header />
          <main className="workspace">
            <LeftPanel />
            <Canvas />
            <RightPanel />
          </main>
          {toast && <div className={`toast toast--${toast.tone}`}>{toast.message}</div>}
        </div>
      </DiagnosticsContext.Provider>
    </ReactFlowProvider>
  );
}
