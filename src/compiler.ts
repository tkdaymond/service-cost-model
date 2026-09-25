import { targetHandles } from './nodeSpec';
import type { AppEdge, AppNode, Field, Model } from './types';

/** Expression tree compiled from the canvas graph. `nodeId` points back to the node that produced it. */
export type Expr =
  | { kind: 'field'; fieldId: string; nodeId?: string }
  | { kind: 'num'; value: number; nodeId?: string }
  | { kind: 'add' | 'mul'; args: Expr[]; nodeId?: string }
  | { kind: 'sub' | 'div'; a: Expr; b: Expr; nodeId?: string }
  | { kind: 'markup' | 'margin'; base: Expr; rate: Expr; nodeId?: string }
  | { kind: 'call'; fn: 'MIN' | 'MAX' | 'ROUND'; args: Expr[]; nodeId?: string };

export interface Issue {
  nodeId?: string;
  message: string;
}

export interface CompileResult {
  /** Present only when the graph compiled without errors. */
  expr?: Expr;
  /** The compiled sub-expression for every node that feeds the result (for showing intermediate values). */
  exprByNode: Map<string, Expr>;
  usedFieldIds: string[];
  errors: Issue[];
  warnings: Issue[];
}

export function compileModel(model: Pick<Model, 'fields' | 'nodes' | 'edges'>): CompileResult {
  const nodesById = new Map(model.nodes.map((n) => [n.id, n]));
  const fieldsById = new Map(model.fields.map((f) => [f.id, f]));
  const errors: Issue[] = [];
  const exprByNode = new Map<string, Expr>();
  const usedFieldIds = new Set<string>();
  const visited = new Set<string>();

  const incoming = new Map<string, AppEdge[]>();
  for (const e of model.edges) {
    if (!nodesById.has(e.source) || !nodesById.has(e.target)) continue;
    const list = incoming.get(e.target) ?? [];
    list.push(e);
    incoming.set(e.target, list);
  }

  /** Incoming sources on one handle, ordered left-to-right so the formula matches the canvas. */
  const inputsOn = (nodeId: string, handle: string): AppNode[] =>
    (incoming.get(nodeId) ?? [])
      .filter((e) => (e.targetHandle ?? 'in') === handle)
      .map((e) => nodesById.get(e.source)!)
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);

  const build = (node: AppNode, stack: Set<string>): Expr | null => {
    if (stack.has(node.id)) {
      errors.push({ nodeId: node.id, message: 'This node is part of a loop. Formulas cannot refer back to themselves.' });
      return null;
    }
    const cached = exprByNode.get(node.id);
    if (cached) return cached;
    visited.add(node.id);
    stack.add(node.id);

    const one = (handle: string, what: string): Expr | null => {
      const [src] = inputsOn(node.id, handle);
      if (!src) {
        errors.push({ nodeId: node.id, message: `${nodeLabel(node, fieldsById)} is missing its ${what} input.` });
        return null;
      }
      return build(src, stack);
    };
    const many = (min: number): Expr[] | null => {
      const srcs = inputsOn(node.id, 'in');
      if (srcs.length < min) {
        errors.push({ nodeId: node.id, message: `${nodeLabel(node, fieldsById)} needs at least ${min} inputs (has ${srcs.length}).` });
      }
      const built = srcs.map((s) => build(s, stack));
      return srcs.length >= min && built.every(Boolean) ? (built as Expr[]) : null;
    };

    let expr: Expr | null = null;
    switch (node.type) {
      case 'field': {
        if (fieldsById.has(node.data.fieldId)) {
          usedFieldIds.add(node.data.fieldId);
          expr = { kind: 'field', fieldId: node.data.fieldId, nodeId: node.id };
        } else {
          errors.push({ nodeId: node.id, message: 'This node refers to a field that no longer exists.' });
        }
        break;
      }
      case 'constant':
        expr = { kind: 'num', value: node.data.value, nodeId: node.id };
        break;
      case 'operator': {
        const { op } = node.data;
        if (op === 'add' || op === 'multiply') {
          const args = many(2);
          if (args) expr = { kind: op === 'add' ? 'add' : 'mul', args, nodeId: node.id };
        } else {
          const a = one('a', 'A');
          const b = one('b', 'B');
          if (a && b) expr = { kind: op === 'subtract' ? 'sub' : 'div', a, b, nodeId: node.id };
        }
        break;
      }
      case 'percent': {
        const base = one('base', 'base');
        const rate = one('rate', 'rate');
        if (base && rate) expr = { kind: node.data.mode, base, rate, nodeId: node.id };
        break;
      }
      case 'function': {
        const { fn } = node.data;
        if (fn === 'round') {
          const x = one('in', 'value');
          if (x) expr = { kind: 'call', fn: 'ROUND', args: [x, { kind: 'num', value: node.data.digits }], nodeId: node.id };
        } else {
          const args = many(2);
          if (args) expr = { kind: 'call', fn: fn === 'min' ? 'MIN' : 'MAX', args, nodeId: node.id };
        }
        break;
      }
      case 'output':
        expr = one('in', 'result');
        break;
    }

    stack.delete(node.id);
    if (expr) exprByNode.set(node.id, expr);
    return expr;
  };

  const outputs = model.nodes.filter((n) => n.type === 'output');
  let expr: Expr | null = null;
  if (outputs.length !== 1) {
    errors.push({ message: `The model needs exactly one result node (found ${outputs.length}).` });
  } else {
    expr = build(outputs[0], new Set());
  }

  // Check inputs on handles that only accept one connection.
  for (const node of model.nodes) {
    for (const h of targetHandles(node)) {
      if (!h.multi && inputsOn(node.id, h.id).length > 1) {
        errors.push({ nodeId: node.id, message: `${nodeLabel(node, fieldsById)} has more than one connection on a single input.` });
      }
    }
  }

  const warnings: Issue[] = model.nodes
    .filter((n) => !visited.has(n.id))
    .map((n) => ({ nodeId: n.id, message: `${nodeLabel(n, fieldsById)} is not connected to the result and is ignored.` }));

  return {
    expr: errors.length === 0 && expr ? expr : undefined,
    exprByNode,
    usedFieldIds: model.fields.filter((f) => usedFieldIds.has(f.id)).map((f) => f.id),
    errors: dedupe(errors),
    warnings,
  };
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.nodeId}|${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function nodeLabel(node: AppNode, fieldsById: Map<string, Field>): string {
  switch (node.type) {
    case 'field':
      return `"${fieldsById.get(node.data.fieldId)?.name ?? 'Unknown field'}"`;
    case 'constant':
      return `Constant ${node.data.value}`;
    case 'output':
      return `"${node.data.name}"`;
    default:
      return `"${node.data.subtitle || node.data.label}"`;
  }
}

// ---------------------------------------------------------------------------
// Formula text
// ---------------------------------------------------------------------------

export type Dialect = 'excel' | 'readable';

const PRECEDENCE: Record<Expr['kind'], number> = {
  add: 1,
  sub: 1,
  mul: 2,
  div: 2,
  markup: 2,
  margin: 2,
  field: 3,
  num: 3,
  call: 3,
};

/** Rewrites markup/margin into plain arithmetic so the printer only knows basic operators. */
function lower(e: Expr): Expr {
  switch (e.kind) {
    case 'markup':
      return { kind: 'mul', args: [lower(e.base), { kind: 'add', args: [{ kind: 'num', value: 1 }, lower(e.rate)] }] };
    case 'margin':
      return { kind: 'div', a: lower(e.base), b: { kind: 'sub', a: { kind: 'num', value: 1 }, b: lower(e.rate) } };
    case 'add':
    case 'mul':
    case 'call':
      return { ...e, args: e.args.map(lower) };
    case 'sub':
    case 'div':
      return { ...e, a: lower(e.a), b: lower(e.b) };
    default:
      return e;
  }
}

/**
 * Prints an expression. `nameOf` maps a field id to the text used for it
 * (the Excel defined name, or the display name for the readable version).
 */
export function formatFormula(expr: Expr, nameOf: (fieldId: string) => string, dialect: Dialect): string {
  const ops =
    dialect === 'excel'
      ? { add: '+', sub: '-', mul: '*', div: '/', sep: ',' }
      : { add: ' + ', sub: ' − ', mul: ' × ', div: ' ÷ ', sep: ', ' };

  const print = (e: Expr): string => {
    const wrap = (child: Expr, needsParens: boolean) => (needsParens ? `(${print(child)})` : print(child));
    switch (e.kind) {
      case 'field':
        return nameOf(e.fieldId);
      case 'num':
        return e.value < 0 ? `(${e.value})` : String(e.value);
      case 'add':
        return e.args.map((a) => wrap(a, PRECEDENCE[a.kind] < 1)).join(ops.add);
      case 'mul':
        return e.args.map((a) => wrap(a, PRECEDENCE[a.kind] < 2)).join(ops.mul);
      case 'sub':
        return `${wrap(e.a, PRECEDENCE[e.a.kind] < 1)}${ops.sub}${wrap(e.b, PRECEDENCE[e.b.kind] <= 1)}`;
      case 'div':
        return `${wrap(e.a, PRECEDENCE[e.a.kind] < 2)}${ops.div}${wrap(e.b, PRECEDENCE[e.b.kind] <= 2)}`;
      case 'call':
        return `${e.fn}(${e.args.map(print).join(ops.sep)})`;
      case 'markup':
      case 'margin':
        return print(lower(e));
    }
  };

  const body = print(lower(expr));
  return dialect === 'excel' ? `=${body}` : body;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export class EvalError extends Error {
  constructor(
    message: string,
    public nodeId?: string,
  ) {
    super(message);
  }
}

/** Evaluates like Excel would. Throws EvalError for division by zero or an impossible margin. */
export function evaluate(expr: Expr, valueOf: (fieldId: string) => number): number {
  const ev = (e: Expr): number => {
    switch (e.kind) {
      case 'field':
        return valueOf(e.fieldId);
      case 'num':
        return e.value;
      case 'add':
        return e.args.reduce((s, a) => s + ev(a), 0);
      case 'mul':
        return e.args.reduce((p, a) => p * ev(a), 1);
      case 'sub':
        return ev(e.a) - ev(e.b);
      case 'div': {
        const d = ev(e.b);
        if (d === 0) throw new EvalError('Division by zero.', e.nodeId);
        return ev(e.a) / d;
      }
      case 'markup':
        return ev(e.base) * (1 + ev(e.rate));
      case 'margin': {
        const rate = ev(e.rate);
        if (rate >= 1) throw new EvalError('A margin must be below 100%. At 100% or more the price is undefined or negative.', e.nodeId);
        return ev(e.base) / (1 - rate);
      }
      case 'call': {
        const args = e.args.map(ev);
        if (e.fn === 'MIN') return Math.min(...args);
        if (e.fn === 'MAX') return Math.max(...args);
        return excelRound(args[0], args[1]);
      }
    }
  };
  return ev(expr);
}

/** Excel's ROUND rounds halves away from zero; Math.round does not for negatives. */
export function excelRound(value: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = Math.abs(value) * factor;
  // Nudge by a tiny epsilon so 1.005 rounds to 1.01 as it does in Excel.
  return (Math.sign(value) * Math.round(scaled + 1e-9)) / factor;
}
