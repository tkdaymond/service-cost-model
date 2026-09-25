import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange, type XYPosition } from '@xyflow/react';
import { create } from 'zustand';
import { defaultModel, OUTPUT_NODE_ID } from './defaults';
import { targetHandles } from './nodeSpec';
import type { AppEdge, AppNode, Field, Model } from './types';

const STORAGE_KEY = 'service-cost-model:v1';
const HISTORY_LIMIT = 100;

export type Selection = { kind: 'node'; id: string } | { kind: 'field'; id: string } | null;

interface State {
  model: Model;
  selection: Selection;
  rightTab: 'settings' | 'preview';
  testMode: boolean;
  dirty: boolean;
  toast: { message: string; tone: 'info' | 'error' } | null;
  past: Model[];
  future: Model[];
  /** Consecutive edits with the same key (e.g. typing in one input) share a single undo step. */
  lastEditKey: string | null;

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<AppEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  beginDrag: () => void;
  addNode: (node: Omit<AppNode, 'id' | 'position'>, position: XYPosition) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
  addField: (group: string) => void;
  updateField: (id: string, patch: Partial<Field>) => void;
  deleteField: (id: string) => void;
  updateMeta: (patch: Partial<Pick<Model, 'name' | 'description'>>) => void;
  select: (selection: Selection) => void;
  setRightTab: (tab: State['rightTab']) => void;
  toggleTest: () => void;
  undo: () => void;
  redo: () => void;
  save: () => void;
  reset: () => void;
  importModel: (model: Model) => void;
  showToast: (message: string, tone?: 'info' | 'error') => void;
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

function loadModel(): Model {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Model;
      if (Array.isArray(parsed.fields) && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed;
    }
  } catch {
    // Corrupt or unavailable storage: fall back to the template.
  }
  return defaultModel();
}

/** Removes transient React Flow state so it does not leak into undo history or saved files. */
function clean(model: Model): Model {
  return {
    ...model,
    nodes: model.nodes.map(({ selected: _s, dragging: _d, measured: _m, ...n }) => n as AppNode),
    edges: model.edges.map(({ selected: _s, ...e }) => e),
  };
}

/** Returns true if `from` can already reach `to` by following edges downstream. */
function reaches(edges: AppEdge[], from: string, to: string): boolean {
  const stack = [from];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of edges) if (e.source === id) stack.push(e.target);
  }
  return false;
}

export function isValidConnection(model: Model, c: { source: string | null; target: string | null }): boolean {
  if (!c.source || !c.target || c.source === c.target) return false;
  if (!model.nodes.some((n) => n.id === c.target)) return false;
  return !reaches(model.edges, c.target, c.source);
}

export const useStore = create<State>((set, get) => {
  /** Applies a change to the model and records an undo step (unless it continues the same edit). */
  const commit = (mutate: (m: Model) => Model, editKey: string | null = null) => {
    const { model, past, lastEditKey } = get();
    const continuing = editKey !== null && editKey === lastEditKey;
    set({
      model: mutate(model),
      past: continuing ? past : [...past, clean(model)].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
      lastEditKey: editKey,
    });
  };

  return {
    model: loadModel(),
    selection: { kind: 'node', id: OUTPUT_NODE_ID },
    rightTab: 'settings',
    testMode: false,
    dirty: false,
    toast: null,
    past: [],
    future: [],
    lastEditKey: null,

    onNodesChange: (changes) => {
      const removing = changes.filter((c) => c.type === 'remove');
      if (removing.length) {
        const ids = new Set(removing.map((c) => c.id));
        commit((m) => ({
          ...m,
          nodes: applyNodeChanges(changes, m.nodes),
          edges: m.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target)),
        }));
        const sel = get().selection;
        if (sel?.kind === 'node' && ids.has(sel.id)) set({ selection: null });
        return;
      }
      const moved = changes.some((c) => c.type === 'position' && !c.dragging);
      set((s) => ({ model: { ...s.model, nodes: applyNodeChanges(changes, s.model.nodes) }, dirty: s.dirty || moved }));
    },

    onEdgesChange: (changes) => {
      if (changes.some((c) => c.type === 'remove')) {
        commit((m) => ({ ...m, edges: applyEdgeChanges(changes, m.edges) }));
      } else {
        set((s) => ({ model: { ...s.model, edges: applyEdgeChanges(changes, s.model.edges) } }));
      }
    },

    onConnect: (c) => {
      const { model } = get();
      if (!isValidConnection(model, c)) return;
      const target = model.nodes.find((n) => n.id === c.target)!;
      const handle = targetHandles(target).find((h) => h.id === (c.targetHandle ?? 'in'));
      commit((m) => {
        // A single-input handle keeps only the newest connection; never duplicate the same wire.
        const edges = m.edges.filter(
          (e) =>
            !(e.target === c.target && e.targetHandle === c.targetHandle && (!handle?.multi || e.source === c.source)),
        );
        return { ...m, edges: addEdge({ ...c, id: newId('e') }, edges) };
      });
    },

    beginDrag: () => commit((m) => m),

    addNode: (partial, position) => {
      const id = newId('n');
      commit((m) => ({
        ...m,
        nodes: [...m.nodes.map((n) => ({ ...n, selected: false })), { ...partial, id, position, selected: true } as AppNode],
      }));
      set({ selection: { kind: 'node', id }, rightTab: 'settings' });
    },

    updateNodeData: (id, patch) =>
      commit(
        (m) => ({ ...m, nodes: m.nodes.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as AppNode) : n)) }),
        `node:${id}:${Object.keys(patch).join(',')}`,
      ),

    deleteNode: (id) => {
      if (id === OUTPUT_NODE_ID) return;
      commit((m) => ({
        ...m,
        nodes: m.nodes.filter((n) => n.id !== id),
        edges: m.edges.filter((e) => e.source !== id && e.target !== id),
      }));
      set({ selection: null });
    },

    addField: (group) => {
      const id = newId('f');
      const taken = new Set(get().model.fields.map((f) => f.name.toLowerCase()));
      let name = 'New Field';
      for (let i = 2; taken.has(name.toLowerCase()); i++) name = `New Field ${i}`;
      commit((m) => ({
        ...m,
        fields: [...m.fields, { id, name, description: '', type: 'number', icon: 'hash', group, sampleValue: 0 }],
      }));
      set({ selection: { kind: 'field', id }, rightTab: 'settings' });
    },

    updateField: (id, patch) =>
      commit(
        (m) => ({ ...m, fields: m.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }),
        `field:${id}:${Object.keys(patch).join(',')}`,
      ),

    deleteField: (id) => {
      commit((m) => {
        const nodeIds = new Set(m.nodes.filter((n) => n.type === 'field' && n.data.fieldId === id).map((n) => n.id));
        return {
          ...m,
          fields: m.fields.filter((f) => f.id !== id),
          nodes: m.nodes.filter((n) => !nodeIds.has(n.id)),
          edges: m.edges.filter((e) => !nodeIds.has(e.source) && !nodeIds.has(e.target)),
        };
      });
      set({ selection: null });
    },

    updateMeta: (patch) => commit((m) => ({ ...m, ...patch }), `meta:${Object.keys(patch).join(',')}`),

    select: (selection) => set({ selection, lastEditKey: null }),
    setRightTab: (rightTab) => set({ rightTab }),
    toggleTest: () => set((s) => ({ testMode: !s.testMode, rightTab: s.testMode ? s.rightTab : 'preview' })),

    undo: () => {
      const { past, future, model } = get();
      if (!past.length) return;
      set({ model: past[past.length - 1], past: past.slice(0, -1), future: [clean(model), ...future], dirty: true, lastEditKey: null });
    },

    redo: () => {
      const { past, future, model } = get();
      if (!future.length) return;
      set({ model: future[0], future: future.slice(1), past: [...past, clean(model)], dirty: true, lastEditKey: null });
    },

    save: () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean(get().model)));
        set({ dirty: false });
        get().showToast('Saved in this browser.');
      } catch {
        get().showToast('Could not save: browser storage is unavailable.', 'error');
      }
    },

    reset: () => {
      commit(() => defaultModel());
      set({ selection: { kind: 'node', id: OUTPUT_NODE_ID } });
    },

    importModel: (model) => {
      commit(() => model);
      set({ selection: { kind: 'node', id: OUTPUT_NODE_ID }, rightTab: 'settings' });
    },

    showToast: (message, tone = 'info') => {
      set({ toast: { message, tone } });
      window.setTimeout(() => {
        if (get().toast?.message === message) set({ toast: null });
      }, 3000);
    },
  };
});
