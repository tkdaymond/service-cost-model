import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import { formatValue, useDiagnostics } from '../diagnostics';
import { nodeIcon } from '../icons';
import { targetHandles } from '../nodeSpec';
import { useStore } from '../store';
import type { AppNode, OutputNodeData } from '../types';

type Variant = 'input' | 'math' | 'sum' | 'fn' | 'const' | 'result';

function variantOf(node: AppNode): Variant {
  switch (node.type) {
    case 'field':
      return 'input';
    case 'operator':
      return node.data.op === 'add' || node.data.op === 'subtract' ? 'sum' : 'math';
    case 'percent':
      return 'math';
    case 'function':
      return 'fn';
    case 'constant':
      return 'const';
    case 'output':
      return 'result';
  }
}

/** Where each input handle sits on the card. */
function handleStyle(node: AppNode, id: string): { position: Position; style?: React.CSSProperties } {
  if (node.type === 'percent' && id === 'rate') return { position: Position.Left };
  if (id === 'a') return { position: Position.Top, style: { left: '30%' } };
  if (id === 'b') return { position: Position.Top, style: { left: '70%' } };
  return { position: Position.Top };
}

export function CanvasNode(props: NodeProps<AppNode>) {
  const node = { id: props.id, type: props.type, data: props.data, position: { x: 0, y: 0 } } as AppNode;
  const fields = useStore((s) => s.model.fields);
  const testMode = useStore((s) => s.testMode);
  // Handle labels only guide wiring; hide them once something is plugged in.
  const connectedHandles = useStore((s) => s.model.edges.filter((e) => e.target === props.id).map((e) => e.targetHandle).join('|'));
  const diag = useDiagnostics();

  const field = node.type === 'field' ? fields.find((f) => f.id === node.data.fieldId) : undefined;
  const Icon = nodeIcon(node, field?.icon);
  const variant = variantOf(node);
  const errors = diag.errorsByNode.get(node.id);
  const warnings = diag.warningsByNode.get(node.id);

  let title: string;
  let subtitle: string | undefined;
  switch (node.type) {
    case 'field':
      title = field?.name ?? 'Missing field';
      break;
    case 'constant':
      title = String(node.data.value);
      subtitle = node.data.label;
      break;
    case 'output':
      title = node.data.name;
      subtitle = 'Final calculated cost';
      break;
    default:
      title = node.data.label;
      subtitle = node.data.subtitle;
  }

  const computed = diag.valuesByNode.get(node.id);
  let badge: string | undefined;
  if (testMode && computed) {
    if (computed.error) badge = 'Error';
    else if (node.type === 'output') {
      const out = node.data as OutputNodeData;
      badge = formatValue(computed.value!, out.format, out.decimals);
    } else badge = formatValue(computed.value!, computed.unit);
  }

  const className = [
    'cnode',
    `cnode--${variant}`,
    props.selected && 'is-selected',
    errors && 'has-error',
    !errors && warnings && 'is-unused',
    subtitle ? '' : 'is-compact',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} title={[...(errors ?? []), ...(warnings ?? [])].join('\n') || undefined}>
      {targetHandles(node).map((h) => {
        const { position, style } = handleStyle(node, h.id);
        return (
          <Handle key={h.id} id={h.id} type="target" position={position} style={style}>
            {h.label && !connectedHandles.split('|').includes(h.id) && <span className={`handle-label handle-label--${position}`}>{h.label}</span>}
          </Handle>
        );
      })}

      <div className="cnode__icon">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div className="cnode__text">
        <div className="cnode__title">{title}</div>
        {subtitle && <div className="cnode__subtitle">{subtitle}</div>}
      </div>
      {errors && <AlertTriangle className="cnode__alert" size={16} />}
      {badge && <div className={`cnode__badge ${computed?.error ? 'is-error' : ''}`}>{badge}</div>}

      {node.type !== 'output' && <Handle id="out" type="source" position={Position.Bottom} />}
      {node.type === 'field' && <Handle id="out-right" type="source" position={Position.Right} />}
    </div>
  );
}

export const nodeTypes = {
  field: CanvasNode,
  operator: CanvasNode,
  percent: CanvasNode,
  function: CanvasNode,
  constant: CanvasNode,
  output: CanvasNode,
};
