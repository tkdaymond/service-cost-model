import { describe, expect, it } from 'vitest';
import { compileModel, evaluate, formatFormula, type Expr } from './compiler';
import { defaultModel, OUTPUT_NODE_ID } from './defaults';
import { excelNamesFor, toExcelName } from './excelNames';
import type { AppNode, Model } from './types';

const f = (fieldId: string): Expr => ({ kind: 'field', fieldId });
const num = (value: number): Expr => ({ kind: 'num', value });
const id = (s: string) => s;

describe('default model', () => {
  const model = defaultModel();
  const result = compileModel(model);
  const names = excelNamesFor(model.fields);

  it('compiles without errors', () => {
    expect(result.errors).toEqual([]);
    expect(result.expr).toBeDefined();
  });

  it('produces the expected Excel and readable formulas', () => {
    expect(formatFormula(result.expr!, (fid) => names.get(fid)!, 'excel')).toBe(
      '=(Hours*Hourly_Rate+Material_Cost)*(1+Overhead_Rate)/(1-Profit_Margin)',
    );
    const display = new Map(model.fields.map((x) => [x.id, x.name]));
    expect(formatFormula(result.expr!, (fid) => display.get(fid)!, 'readable')).toBe(
      '(Hours × Hourly Rate + Material Cost) × (1 + Overhead Rate) ÷ (1 − Profit Margin)',
    );
  });

  it('evaluates with the sample values (margin, not markup)', () => {
    const values = new Map(model.fields.map((x) => [x.id, x.sampleValue]));
    // (40 × 85 + 1200) × 1.15 ÷ 0.8
    expect(evaluate(result.expr!, (fid) => values.get(fid)!)).toBeCloseTo(6612.5, 10);
  });

  it('lists only the fields the formula uses', () => {
    expect(result.usedFieldIds).toEqual(['hours', 'hourlyRate', 'materialCost', 'overheadRate', 'profitMargin']);
  });

  it('warns about nothing', () => {
    expect(result.warnings).toEqual([]);
  });
});

describe('validation', () => {
  it('reports missing inputs and does not return an expression', () => {
    const model = defaultModel();
    model.edges = model.edges.filter((e) => !(e.target === 'n-overhead' && e.targetHandle === 'rate'));
    const result = compileModel(model);
    expect(result.expr).toBeUndefined();
    expect(result.errors).toContainEqual({ nodeId: 'n-overhead', message: '"Add Overhead" is missing its rate input.' });
    expect(result.warnings.map((w) => w.nodeId)).toEqual(['n-overhead-rate']);
  });

  it('detects loops', () => {
    const model = defaultModel();
    model.edges.push({ id: 'loop', source: 'n-direct', target: 'n-labor', targetHandle: 'in', sourceHandle: 'out' });
    const result = compileModel(model);
    expect(result.expr).toBeUndefined();
    expect(result.errors.some((e) => e.message.includes('loop'))).toBe(true);
  });

  it('requires a result node', () => {
    const model = defaultModel();
    model.nodes = model.nodes.filter((n) => n.id !== OUTPUT_NODE_ID);
    expect(compileModel(model).errors[0].message).toMatch(/exactly one result/);
  });

  it('respects A/B order for subtract regardless of canvas position', () => {
    const model: Model = {
      name: '',
      description: '',
      fields: defaultModel().fields,
      nodes: [
        { id: 'x', type: 'field', position: { x: 500, y: 0 }, data: { fieldId: 'hours' } },
        { id: 'y', type: 'field', position: { x: 0, y: 0 }, data: { fieldId: 'teamSize' } },
        { id: 's', type: 'operator', position: { x: 0, y: 100 }, data: { op: 'subtract', label: '', subtitle: '' } },
        { id: 'o', type: 'output', position: { x: 0, y: 200 }, data: { name: 'R', description: '', format: 'number', decimals: 0 } },
      ] as AppNode[],
      edges: [
        { id: '1', source: 'x', target: 's', targetHandle: 'a' },
        { id: '2', source: 'y', target: 's', targetHandle: 'b' },
        { id: '3', source: 's', target: 'o', targetHandle: 'in' },
      ],
    };
    const { expr } = compileModel(model);
    expect(formatFormula(expr!, id, 'excel')).toBe('=hours-teamSize');
  });
});

describe('formatFormula precedence', () => {
  it('keeps parentheses only where they change meaning', () => {
    expect(formatFormula({ kind: 'sub', a: f('a'), b: { kind: 'sub', a: f('b'), b: f('c') } }, id, 'excel')).toBe('=a-(b-c)');
    expect(formatFormula({ kind: 'sub', a: { kind: 'sub', a: f('a'), b: f('b') }, b: f('c') }, id, 'excel')).toBe('=a-b-c');
    expect(formatFormula({ kind: 'div', a: f('a'), b: { kind: 'mul', args: [f('b'), f('c')] } }, id, 'excel')).toBe('=a/(b*c)');
    expect(formatFormula({ kind: 'mul', args: [{ kind: 'add', args: [f('a'), f('b')] }, f('c')] }, id, 'excel')).toBe('=(a+b)*c');
    expect(formatFormula({ kind: 'add', args: [f('a'), { kind: 'mul', args: [f('b'), f('c')] }] }, id, 'excel')).toBe('=a+b*c');
    expect(formatFormula({ kind: 'mul', args: [f('a'), num(-2)] }, id, 'excel')).toBe('=a*(-2)');
  });

  it('prints functions', () => {
    const e: Expr = { kind: 'call', fn: 'ROUND', args: [{ kind: 'call', fn: 'MAX', args: [f('a'), num(10)] }, num(2)] };
    expect(formatFormula(e, id, 'excel')).toBe('=ROUND(MAX(a,10),2)');
  });
});

describe('evaluate', () => {
  it('rejects margins of 100% or more', () => {
    expect(() => evaluate({ kind: 'margin', base: num(100), rate: num(1) }, () => 0)).toThrow(/below 100%/);
  });
  it('rejects division by zero', () => {
    expect(() => evaluate({ kind: 'div', a: num(1), b: num(0) }, () => 0)).toThrow(/zero/);
  });
  it('rounds halves away from zero like Excel', () => {
    const round = (v: number, d: number) => evaluate({ kind: 'call', fn: 'ROUND', args: [num(v), num(d)] }, () => 0);
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(-2.5, 0)).toBe(-3);
    expect(round(1234, -2)).toBe(1200);
  });
});

describe('Excel names', () => {
  it('sanitizes display names', () => {
    expect(toExcelName('Hourly Rate')).toBe('Hourly_Rate');
    expect(toExcelName('Overhead %')).toBe('Overhead_Pct');
    expect(toExcelName('2nd Shift')).toBe('_2nd_Shift');
    expect(toExcelName('  ')).toBe('Field');
    expect(toExcelName('Cost (USD)')).toBe('Cost_USD');
  });

  it('avoids names Excel would read as cell references', () => {
    expect(toExcelName('ABC1')).toBe('ABC1_');
    expect(toExcelName('Tax2024')).toBe('Tax2024_'); // TAX is a real column
    expect(toExcelName('Year2024')).toBe('Year2024'); // YEA is beyond column XFD
    expect(toExcelName('R')).toBe('R_');
    expect(toExcelName('c')).toBe('c_');
    expect(toExcelName('R1C1')).toBe('R1C1_');
    expect(toExcelName('True')).toBe('True_');
  });

  it('makes names unique, ignoring case', () => {
    const fields = ['Rate', 'rate', 'Rate'].map((name, i) => ({ ...defaultModel().fields[0], id: `f${i}`, name }));
    expect([...excelNamesFor(fields).values()]).toEqual(['Rate', 'rate_2', 'Rate_3']);
  });
});

describe('display rounding', () => {
  it('matches Excel on halves that are not exact in binary', async () => {
    const { formatValue } = await import('./diagnostics');
    expect(formatValue(7834.375, 'currency', 2)).toBe('$7,834.38');
    expect(formatValue(1.005, 'number', 2)).toBe('1.005');
    expect(formatValue(0.12345, 'percent', 2)).toBe('12.35%');
  });
});
