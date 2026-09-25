import { useReactFlow } from '@xyflow/react';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FIELD_ICONS } from '../icons';
import { DND_TYPE, FUNCTIONS, OPERATORS, type PaletteItem } from '../palette';
import { useStore } from '../store';
import type { AppNode, Field } from '../types';

type Tab = 'fields' | 'functions' | 'operators';

function startDrag(event: React.DragEvent, node: Omit<AppNode, 'id' | 'position'>) {
  event.dataTransfer.setData(DND_TYPE, JSON.stringify(node));
  event.dataTransfer.effectAllowed = 'copy';
}

const NEW_W = 220;
const NEW_H = 70;

/** Nearest spot to `start` (searching outward in rings) where a new card overlaps no existing node. */
function freeSpot(nodes: AppNode[], start: { x: number; y: number }) {
  const overlaps = (x: number, y: number) =>
    nodes.some((n) => {
      const w = n.measured?.width ?? NEW_W;
      const h = n.measured?.height ?? NEW_H;
      return x < n.position.x + w + 16 && x + NEW_W + 16 > n.position.x && y < n.position.y + h + 16 && y + NEW_H + 16 > n.position.y;
    });
  const step = 30;
  for (let ring = 0; ring < 30; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = start.x + dx * step;
        const y = start.y + dy * step;
        if (!overlaps(x, y)) return { x, y };
      }
    }
  }
  return start;
}

/** Adds a node in free space near the centre of the visible canvas (for double-click instead of drag). */
function useAddAtCentre() {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useStore((s) => s.addNode);
  return (node: Omit<AppNode, 'id' | 'position'>) => {
    const el = document.querySelector('.canvas')!.getBoundingClientRect();
    const centre = screenToFlowPosition({ x: el.left + el.width / 2, y: el.top + el.height / 2 });
    addNode(node, freeSpot(useStore.getState().model.nodes, { x: centre.x - NEW_W / 2, y: centre.y - NEW_H / 2 }));
  };
}

function FieldItem({ field }: { field: Field }) {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const addAtCentre = useAddAtCentre();
  const Icon = FIELD_ICONS[field.icon];
  const node = { type: 'field', data: { fieldId: field.id } } as const;
  const active = selection?.kind === 'field' && selection.id === field.id;
  return (
    <div
      className={`palette-item ${active ? 'is-active' : ''}`}
      draggable
      onDragStart={(e) => startDrag(e, node)}
      onClick={() => select({ kind: 'field', id: field.id })}
      onDoubleClick={() => addAtCentre(node)}
      title="Drag onto the canvas, or double-click to add. Click to edit."
    >
      <div className="palette-item__icon">
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div>
        <div className="palette-item__title">{field.name}</div>
        {field.description && <div className="palette-item__desc">{field.description}</div>}
      </div>
    </div>
  );
}

function PaletteList({ items }: { items: PaletteItem[] }) {
  const addAtCentre = useAddAtCentre();
  return (
    <div className="palette-list">
      {items.map((item) => (
        <div
          key={item.key}
          className="palette-item"
          draggable
          onDragStart={(e) => startDrag(e, item.node)}
          onDoubleClick={() => addAtCentre(item.node)}
          title="Drag onto the canvas, or double-click to add."
        >
          <div className="palette-item__icon">
            <item.icon size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="palette-item__title">{item.label}</div>
            <div className="palette-item__desc">{item.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>('fields');
  const [query, setQuery] = useState('');
  const fields = useStore((s) => s.model.fields);
  const addField = useStore((s) => s.addField);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Field[]>();
    for (const f of fields) {
      const group = f.group.trim() || 'Other';
      if (!map.has(group)) map.set(group, []);
      if (!q || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)) map.get(group)!.push(f);
    }
    return [...map.entries()];
  }, [fields, query]);

  return (
    <aside className="left-panel">
      <div className="tabs">
        {(['fields', 'functions', 'operators'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="left-panel__body">
        {tab === 'fields' && (
          <>
            <label className="search">
              <Search size={18} />
              <input placeholder="Search fields..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {groups.map(([group, items]) => (
              <section key={group} className="palette-group">
                <div className="palette-group__head">
                  <h3>{group}</h3>
                  <button className="link-btn" onClick={() => addField(group)} title={`Add a field to ${group}`}>
                    <Plus size={14} /> New
                  </button>
                </div>
                <div className="palette-list">
                  {items.map((f) => (
                    <FieldItem key={f.id} field={f} />
                  ))}
                  {items.length === 0 && <div className="empty">No matching fields</div>}
                </div>
              </section>
            ))}
            {groups.length === 0 && (
              <button className="btn btn--secondary btn--block" onClick={() => addField('Service Inputs')}>
                <Plus size={16} /> New field
              </button>
            )}
          </>
        )}
        {tab === 'functions' && <PaletteList items={FUNCTIONS} />}
        {tab === 'operators' && <PaletteList items={OPERATORS} />}
      </div>
    </aside>
  );
}
