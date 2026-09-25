import { AlertCircle, AlertTriangle, Check, Copy, FileSpreadsheet, Info, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatFormula } from '../compiler';
import { formatValue, useDiagnostics } from '../diagnostics';
import { excelNamesFor } from '../excelNames';
import { FIELD_ICONS, nodeIcon } from '../icons';
import { useStore } from '../store';
import type {
  AppNode,
  ConstantNode,
  Field,
  FieldType,
  FunctionNode,
  IconName,
  OperatorNode,
  OutputFormat,
  OutputNode,
  PercentMode,
  PercentNode,
} from '../types';
import { Label, NumberInput } from './inputs';

const TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
];

// ---------------------------------------------------------------------------
// Settings forms
// ---------------------------------------------------------------------------

function FieldSettings({ field }: { field: Field }) {
  const { updateField, deleteField } = useStore.getState();
  const fields = useStore((s) => s.model.fields);
  const nodes = useStore((s) => s.model.nodes);
  const uses = nodes.filter((n) => n.type === 'field' && n.data.fieldId === field.id).length;
  const excelName = useMemo(() => excelNamesFor(fields).get(field.id), [fields, field.id]);
  const duplicate = fields.some((f) => f.id !== field.id && f.name.trim().toLowerCase() === field.name.trim().toLowerCase());
  const groups = [...new Set(fields.map((f) => f.group).filter(Boolean))];
  const set = (patch: Partial<Field>) => updateField(field.id, patch);

  return (
    <div className="form">
      <div className="form-row">
        <Label>Name</Label>
        <input className="input" value={field.name} onChange={(e) => set({ name: e.target.value })} />
        {duplicate && <p className="hint hint--warn">Another field already has this name.</p>}
      </div>
      <div className="form-row">
        <Label>Description</Label>
        <textarea className="input" rows={2} value={field.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <div className="form-grid">
        <div className="form-row">
          <Label>Type</Label>
          <select className="input" value={field.type} onChange={(e) => set({ type: e.target.value as FieldType })}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <Label>Sample value</Label>
          <NumberInput
            value={field.sampleValue}
            percent={field.type === 'percent'}
            suffix={field.type === 'currency' ? 'USD' : undefined}
            onChange={(v) => set({ sampleValue: v })}
          />
        </div>
      </div>
      <div className="form-row">
        <Label>Group</Label>
        <input className="input" list="field-groups" value={field.group} onChange={(e) => set({ group: e.target.value })} />
        <datalist id="field-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      <div className="form-row">
        <Label>Icon</Label>
        <div className="icon-picker">
          {(Object.keys(FIELD_ICONS) as IconName[]).map((name) => {
            const Icon = FIELD_ICONS[name];
            return (
              <button
                key={name}
                className={`icon-choice ${field.icon === name ? 'is-active' : ''}`}
                onClick={() => set({ icon: name })}
                title={name}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="form-row">
        <Label hint="used in the exported workbook">Excel name</Label>
        <code className="code-chip">{excelName}</code>
      </div>
      <div className="callout">
        <Info size={18} />
        <span>
          {uses === 0
            ? 'Not on the canvas yet. Drag it from the Fields list, or double-click it.'
            : `Used ${uses} time${uses > 1 ? 's' : ''} on the canvas. Changes apply everywhere it is used.`}
        </span>
      </div>
      <button
        className="btn btn--danger btn--block"
        onClick={() => {
          const msg = uses
            ? `Delete "${field.name}"? It will also be removed from the canvas (${uses} node${uses > 1 ? 's' : ''}).`
            : `Delete "${field.name}"?`;
          if (window.confirm(msg)) deleteField(field.id);
        }}
      >
        <Trash2 size={16} /> Delete field
      </button>
    </div>
  );
}

function OutputSettings({ node }: { node: OutputNode }) {
  const update = useStore((s) => s.updateNodeData);
  const set = (patch: Partial<OutputNode['data']>) => update(node.id, patch);
  return (
    <div className="form">
      <div className="form-row">
        <Label>Name</Label>
        <input className="input" value={node.data.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="form-row">
        <Label>Description</Label>
        <textarea className="input" rows={3} value={node.data.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <div className="form-row">
        <Label>Format</Label>
        <select className="input" value={node.data.format} onChange={(e) => set({ format: e.target.value as OutputFormat })}>
          <option value="currency">Currency (USD)</option>
          <option value="number">Number</option>
          <option value="percent">Percent</option>
        </select>
      </div>
      <div className="form-row">
        <Label>Decimal places</Label>
        <NumberInput value={node.data.decimals} min={0} max={6} step={1} onChange={(v) => set({ decimals: Math.max(0, Math.min(6, Math.round(v))) })} />
      </div>
      <div className="callout callout--brand">
        <Info size={18} />
        <span>This value can be used in reports, quotes, and financial forecasts. Use Export XLSX to get it as a live Excel formula.</span>
      </div>
    </div>
  );
}

function TitleFields({ node }: { node: OperatorNode | PercentNode | FunctionNode }) {
  const update = useStore((s) => s.updateNodeData);
  return (
    <>
      <div className="form-row">
        <Label>Title</Label>
        <input className="input" value={node.data.label} onChange={(e) => update(node.id, { label: e.target.value })} />
      </div>
      <div className="form-row">
        <Label hint="what this step calculates">Subtitle</Label>
        <input className="input" value={node.data.subtitle} onChange={(e) => update(node.id, { subtitle: e.target.value })} />
      </div>
    </>
  );
}

const OP_HELP: Record<OperatorNode['data']['op'], string> = {
  add: 'Adds together every value connected to the top input.',
  multiply: 'Multiplies together every value connected to the top input.',
  subtract: 'Calculates A − B. Connect the first value to A (left) and the value to take away to B (right).',
  divide: 'Calculates A ÷ B. Connect the value to divide to A (left) and the divisor to B (right).',
};

function OperatorSettings({ node }: { node: OperatorNode }) {
  return (
    <div className="form">
      <TitleFields node={node} />
      <p className="hint">{OP_HELP[node.data.op]}</p>
    </div>
  );
}

const MODES: { mode: PercentMode; title: string; formula: string; body: string }[] = [
  {
    mode: 'markup',
    title: 'Markup',
    formula: 'Base × (1 + Rate)',
    body: 'Adds a percentage of the cost. Use for overhead, contingency, or a markup.',
  },
  {
    mode: 'margin',
    title: 'Margin',
    formula: 'Base ÷ (1 − Rate)',
    body: 'Sets the percentage of the final price. Use for profit margin. The rate must stay below 100%.',
  },
];

function PercentSettings({ node }: { node: PercentNode }) {
  const update = useStore((s) => s.updateNodeData);
  return (
    <div className="form">
      <TitleFields node={node} />
      <div className="form-row">
        <Label>Mode</Label>
        <div className="mode-cards">
          {MODES.map((m) => (
            <button key={m.mode} className={`mode-card ${node.data.mode === m.mode ? 'is-active' : ''}`} onClick={() => {
                // Keep the default title in step with the mode; leave custom titles alone.
                const isDefaultLabel = node.data.label === 'Apply Markup' || node.data.label === 'Apply Margin';
                update(node.id, isDefaultLabel ? { mode: m.mode, label: `Apply ${m.title}` } : { mode: m.mode });
              }}>
              <div className="mode-card__head">
                <strong>{m.title}</strong>
                {node.data.mode === m.mode && <Check size={16} />}
              </div>
              <code>{m.formula}</code>
              <span>{m.body}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="callout">
        <Info size={18} />
        <span>
          On $1,000 at 20%: markup gives <strong>$1,200.00</strong> (profit is 16.7% of price), margin gives <strong>$1,250.00</strong>{' '}
          (profit is exactly 20% of price).
        </span>
      </div>
      <p className="hint">Connect the base amount to the top input and the rate to the left input.</p>
    </div>
  );
}

function FunctionSettings({ node }: { node: FunctionNode }) {
  const update = useStore((s) => s.updateNodeData);
  return (
    <div className="form">
      <TitleFields node={node} />
      {node.data.fn === 'round' ? (
        <div className="form-row">
          <Label hint="negative rounds to tens, hundreds…">Decimal places</Label>
          <NumberInput
            value={node.data.digits}
            step={1}
            min={-6}
            max={10}
            onChange={(v) => {
              const digits = Math.max(-6, Math.min(10, Math.round(v)));
              update(node.id, { digits, subtitle: `${digits} decimal${digits === 1 ? '' : 's'}` });
            }}
          />
        </div>
      ) : (
        <p className="hint">
          {node.data.fn === 'max'
            ? 'Returns the largest connected value. Tip: MAX(cost, minimum charge) enforces a minimum price.'
            : 'Returns the smallest connected value. Tip: MIN(cost, cap) enforces a price cap.'}
        </p>
      )}
    </div>
  );
}

function ConstantSettings({ node }: { node: ConstantNode }) {
  const update = useStore((s) => s.updateNodeData);
  return (
    <div className="form">
      <div className="form-row">
        <Label>Value</Label>
        <NumberInput value={node.data.value} onChange={(v) => update(node.id, { value: v })} />
      </div>
      <div className="form-row">
        <Label>Label</Label>
        <input className="input" value={node.data.label} onChange={(e) => update(node.id, { label: e.target.value })} />
      </div>
    </div>
  );
}

function ModelSettings() {
  const model = useStore((s) => s.model);
  const updateMeta = useStore((s) => s.updateMeta);
  return (
    <div className="form">
      <div className="form-row">
        <Label>Model name</Label>
        <input className="input" value={model.name} onChange={(e) => updateMeta({ name: e.target.value })} />
      </div>
      <div className="form-row">
        <Label>Description</Label>
        <textarea className="input" rows={3} value={model.description} onChange={(e) => updateMeta({ description: e.target.value })} />
      </div>
      <p className="hint">Select a node on the canvas or a field in the list to edit it.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview tab
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="icon-btn"
      title="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function Preview() {
  const diag = useDiagnostics();
  const model = useStore((s) => s.model);
  const { updateField, select } = useStore.getState();
  const output = model.nodes.find((n): n is OutputNode => n.type === 'output');
  const used = diag.usedFieldIds.map((id) => model.fields.find((f) => f.id === id)!);
  const names = excelNamesFor(used);
  const display = new Map(model.fields.map((f) => [f.id, f.name]));

  return (
    <div className="preview">
      <div className={`result-card ${diag.expr && diag.result !== undefined ? '' : 'is-error'}`}>
        <div className="result-card__label">{output?.data.name ?? 'Result'} with sample values</div>
        <div className="result-card__value">
          {diag.result !== undefined && output ? formatValue(diag.result, output.data.format, output.data.decimals) : '—'}
        </div>
        {diag.resultError && <div className="result-card__error">{diag.resultError}</div>}
        {!diag.expr && <div className="result-card__error">Fix the issues below to see a result.</div>}
      </div>

      {used.length > 0 && (
        <section>
          <h4>Sample inputs</h4>
          <div className="sample-list">
            {used.map((f) => (
              <div key={f.id} className="sample-row">
                <span>{f.name}</span>
                <NumberInput value={f.sampleValue} percent={f.type === 'percent'} onChange={(v) => updateField(f.id, { sampleValue: v })} />
              </div>
            ))}
          </div>
        </section>
      )}

      {diag.expr && (
        <section>
          <h4>Formula</h4>
          <div className="formula">
            <div className="formula__text">{formatFormula(diag.expr, (id) => display.get(id) ?? id, 'readable')}</div>
          </div>
          <h4>
            <FileSpreadsheet size={14} /> Excel formula
          </h4>
          <div className="formula formula--code">
            <code>{formatFormula(diag.expr, (id) => names.get(id) ?? id, 'excel')}</code>
            <CopyButton text={formatFormula(diag.expr, (id) => names.get(id) ?? id, 'excel')} />
          </div>
        </section>
      )}

      {(diag.errors.length > 0 || diag.warnings.length > 0) && (
        <section>
          <h4>Issues</h4>
          <ul className="issues">
            {[...diag.errors, ...diag.warnings.map((w) => ({ ...w, warn: true }))].map((i, idx) => (
              <li
                key={idx}
                className={'warn' in i ? 'issue issue--warn' : 'issue'}
                onClick={() => i.nodeId && select({ kind: 'node', id: i.nodeId })}
              >
                {'warn' in i ? <AlertTriangle size={16} /> : <AlertCircle size={16} />}
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<AppNode['type'], string> = {
  field: 'Input field',
  operator: 'Operator',
  percent: 'Percentage',
  function: 'Function',
  constant: 'Constant',
  output: 'Calculation result',
};

export function RightPanel() {
  const selection = useStore((s) => s.selection);
  const model = useStore((s) => s.model);
  const tab = useStore((s) => s.rightTab);
  const { setRightTab, deleteNode } = useStore.getState();

  const node = selection?.kind === 'node' ? model.nodes.find((n) => n.id === selection.id) : undefined;
  const fieldId = selection?.kind === 'field' ? selection.id : node?.type === 'field' ? node.data.fieldId : undefined;
  const field = fieldId ? model.fields.find((f) => f.id === fieldId) : undefined;

  let Icon = nodeIcon({ type: 'output' } as AppNode);
  let title = model.name;
  let subtitle = 'Model';
  let tone = 'result';
  if (field) {
    Icon = FIELD_ICONS[field.icon];
    title = field.name;
    subtitle = 'Input field';
    tone = 'input';
  } else if (node) {
    Icon = nodeIcon(node);
    subtitle = KIND_LABEL[node.type];
    tone = node.type === 'output' ? 'result' : node.type === 'constant' ? 'const' : node.type === 'function' ? 'fn' : 'math';
    title =
      node.type === 'output'
        ? node.data.name
        : node.type === 'constant'
          ? `Constant ${node.data.value}`
          : node.type === 'field'
            ? 'Missing field'
            : node.data.subtitle || node.data.label;
  }

  let settings: React.ReactNode;
  if (field) settings = <FieldSettings field={field} />;
  else if (!node) settings = <ModelSettings />;
  else if (node.type === 'output') settings = <OutputSettings node={node} />;
  else if (node.type === 'operator') settings = <OperatorSettings node={node} />;
  else if (node.type === 'percent') settings = <PercentSettings node={node} />;
  else if (node.type === 'function') settings = <FunctionSettings node={node} />;
  else if (node.type === 'constant') settings = <ConstantSettings node={node} />;

  return (
    <aside className="right-panel">
      <div className="right-panel__head">
        <div className={`head-icon head-icon--${tone}`}>
          <Icon size={22} strokeWidth={1.75} />
        </div>
        <div className="right-panel__titles">
          <div className="right-panel__title">{title || 'Untitled'}</div>
          <div className="right-panel__subtitle">{subtitle}</div>
        </div>
      </div>
      <div className="tabs tabs--right">
        <button className={`tab ${tab === 'settings' ? 'is-active' : ''}`} onClick={() => setRightTab('settings')}>
          Settings
        </button>
        <button className={`tab ${tab === 'preview' ? 'is-active' : ''}`} onClick={() => setRightTab('preview')}>
          Preview
        </button>
      </div>
      <div className="right-panel__body">
        {tab === 'settings' ? (
          <>
            {settings}
            {node && node.type !== 'output' && node.type !== 'field' && (
              <button className="btn btn--danger btn--block" onClick={() => deleteNode(node.id)}>
                <Trash2 size={16} /> Remove from canvas
              </button>
            )}
            {node?.type === 'field' && (
              <button className="btn btn--secondary btn--block" onClick={() => deleteNode(node.id)}>
                <Trash2 size={16} /> Remove this node from canvas
              </button>
            )}
          </>
        ) : (
          <Preview />
        )}
      </div>
    </aside>
  );
}
