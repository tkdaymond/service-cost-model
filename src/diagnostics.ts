import { createContext, useContext } from 'react';
import { compileModel, evaluate, EvalError, excelRound, type CompileResult, type Expr } from './compiler';
import type { Field, FieldType, Model, OutputFormat } from './types';

export interface Diagnostics extends CompileResult {
  errorsByNode: Map<string, string[]>;
  warningsByNode: Map<string, string[]>;
  /** Sample-value results for every node that feeds the result. */
  valuesByNode: Map<string, { value?: number; unit: FieldType; error?: string }>;
  result?: number;
  resultError?: string;
}

/** Guesses the display unit of an intermediate value, e.g. hours × rate is currency. */
function unitOf(e: Expr, fields: Map<string, Field>): FieldType {
  switch (e.kind) {
    case 'field':
      return fields.get(e.fieldId)?.type ?? 'number';
    case 'num':
      return 'number';
    case 'add':
    case 'call': {
      const units = e.args.map((a) => unitOf(a, fields));
      return units.find((u) => u !== 'number') ?? 'number';
    }
    case 'mul': {
      const units = e.args.map((a) => unitOf(a, fields));
      if (units.includes('currency')) return 'currency';
      return units.every((u) => u === 'percent') ? 'percent' : 'number';
    }
    case 'sub':
      return unitOf(e.a, fields);
    case 'div':
      return unitOf(e.b, fields) === 'currency' ? 'number' : unitOf(e.a, fields);
    case 'markup':
    case 'margin':
      return unitOf(e.base, fields);
  }
}

const group = (issues: { nodeId?: string; message: string }[]) => {
  const map = new Map<string, string[]>();
  for (const i of issues) if (i.nodeId) map.set(i.nodeId, [...(map.get(i.nodeId) ?? []), i.message]);
  return map;
};

export function diagnose(model: Model): Diagnostics {
  const compiled = compileModel(model);
  const fields = new Map(model.fields.map((f) => [f.id, f]));
  const valueOf = (id: string) => fields.get(id)?.sampleValue ?? 0;

  const valuesByNode: Diagnostics['valuesByNode'] = new Map();
  for (const [nodeId, expr] of compiled.exprByNode) {
    try {
      valuesByNode.set(nodeId, { value: evaluate(expr, valueOf), unit: unitOf(expr, fields) });
    } catch (err) {
      valuesByNode.set(nodeId, { unit: 'number', error: err instanceof Error ? err.message : String(err) });
    }
  }

  let result: number | undefined;
  let resultError: string | undefined;
  const evalErrors: { nodeId?: string; message: string }[] = [];
  if (compiled.expr) {
    try {
      result = evaluate(compiled.expr, valueOf);
    } catch (err) {
      resultError = err instanceof Error ? err.message : String(err);
      if (err instanceof EvalError) evalErrors.push({ nodeId: err.nodeId, message: err.message });
    }
  }

  return {
    ...compiled,
    errorsByNode: group([...compiled.errors, ...evalErrors]),
    warningsByNode: group(compiled.warnings),
    valuesByNode,
    result,
    resultError,
  };
}

export const DiagnosticsContext = createContext<Diagnostics | null>(null);
export const useDiagnostics = () => useContext(DiagnosticsContext)!;

export function formatValue(value: number, format: OutputFormat | FieldType, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  // Round first, the way Excel does: toLocaleString alone shows 7834.375 as 7,834.37 where Excel shows 7,834.38.
  if (format === 'currency') {
    return excelRound(value, decimals).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  if (format === 'percent') {
    return excelRound(value * 100, decimals).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals }) + '%';
  }
  const digits = Math.max(decimals, 4);
  return excelRound(value, digits).toLocaleString('en-US', { maximumFractionDigits: digits });
}
