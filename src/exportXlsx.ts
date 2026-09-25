import ExcelJS from 'exceljs';
import { compileModel, evaluate, formatFormula, type Expr } from './compiler';
import { excelNamesFor, toExcelName } from './excelNames';
import type { FieldType, Model, OutputNodeData, OutputFormat } from './types';

const INPUT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } };
const RESULT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE7E7' } };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEBFB' } };
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FFD0D0D8' } };
const BOX: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export function numberFormat(format: OutputFormat | FieldType, decimals = 2): string {
  const frac = decimals > 0 ? `.${'0'.repeat(decimals)}` : '';
  switch (format) {
    case 'currency':
      return `"$"#,##0${frac}`;
    case 'percent':
      return `0${frac}%`;
    case 'number':
      return `#,##0${frac}`;
  }
}

const INPUT_FORMAT: Record<FieldType, string> = {
  currency: numberFormat('currency', 2),
  percent: numberFormat('percent', 2),
  number: 'General',
};

const TYPE_LABEL: Record<FieldType, string> = { currency: 'Currency', percent: 'Percent', number: 'Number' };

/** Fields wired directly into a margin's rate. These get an Excel data-validation rule of 0% to <100%. */
function marginRateFields(expr: Expr, out = new Set<string>()): Set<string> {
  switch (expr.kind) {
    case 'margin':
      if (expr.rate.kind === 'field') out.add(expr.rate.fieldId);
      marginRateFields(expr.base, out);
      marginRateFields(expr.rate, out);
      break;
    case 'markup':
      marginRateFields(expr.base, out);
      marginRateFields(expr.rate, out);
      break;
    case 'add':
    case 'mul':
    case 'call':
      expr.args.forEach((a) => marginRateFields(a, out));
      break;
    case 'sub':
    case 'div':
      marginRateFields(expr.a, out);
      marginRateFields(expr.b, out);
      break;
  }
  return out;
}

/**
 * Builds a workbook with one "Model" sheet: a yellow input cell per field (each a named range),
 * and a result cell holding a live Excel formula that references those names.
 * Throws if the model does not compile.
 */
export function buildWorkbook(model: Model): ExcelJS.Workbook {
  const compiled = compileModel(model);
  if (!compiled.expr) throw new Error(compiled.errors.map((e) => e.message).join('\n') || 'The model has errors.');
  const expr = compiled.expr;
  const output = model.nodes.find((n) => n.type === 'output')!.data as OutputNodeData;

  const fields = compiled.usedFieldIds.map((id) => model.fields.find((f) => f.id === id)!);
  const names = excelNamesFor(fields);
  const displayNames = new Map(fields.map((f) => [f.id, f.name]));
  const values = new Map(fields.map((f) => [f.id, f.sampleValue]));

  const excelFormula = formatFormula(expr, (id) => names.get(id)!, 'excel');
  const readableFormula = formatFormula(expr, (id) => displayNames.get(id)!, 'readable');
  let sampleResult: number | undefined;
  try {
    sampleResult = evaluate(expr, (id) => values.get(id)!);
  } catch {
    sampleResult = undefined; // Excel will show #DIV/0! or similar; recalculation on open fills it in.
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Service Cost Model';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const ws = wb.addWorksheet('Model', { views: [{ showGridLines: false }] });
  ws.columns = [
    { key: 'name', width: 28 },
    { key: 'value', width: 18 },
    { key: 'type', width: 12 },
    { key: 'desc', width: 52 },
    { key: 'xname', width: 22 },
  ];

  ws.getCell('A1').value = model.name;
  ws.getCell('A1').font = { size: 16, bold: true };
  ws.getCell('A2').value = model.description;
  ws.getCell('A2').font = { italic: true, color: { argb: 'FF6B6B7B' } };

  const header = ws.getRow(4);
  header.values = ['Input', 'Value', 'Type', 'Description', 'Excel name'];
  header.eachCell((c) => {
    c.font = { bold: true };
    c.fill = HEADER_FILL;
    c.border = BOX;
  });

  const marginFields = marginRateFields(expr);
  let row = 5;
  for (const field of fields) {
    const r = ws.getRow(row);
    r.values = [field.name, field.sampleValue, TYPE_LABEL[field.type], field.description, names.get(field.id)];
    r.eachCell({ includeEmpty: true }, (c) => (c.border = BOX));
    const valueCell = r.getCell(2);
    valueCell.fill = INPUT_FILL;
    valueCell.numFmt = INPUT_FORMAT[field.type];
    if (marginFields.has(field.id)) {
      valueCell.dataValidation = {
        type: 'decimal',
        operator: 'between',
        allowBlank: false,
        formulae: [0, 0.9999],
        showErrorMessage: true,
        errorTitle: 'Invalid margin',
        error: 'A profit margin must be at least 0% and below 100%.',
      };
    }
    wb.definedNames.add(`Model!$B$${row}`, names.get(field.id)!);
    row++;
  }

  row++;
  const resultRow = ws.getRow(row);
  resultRow.getCell(1).value = output.name;
  resultRow.getCell(1).font = { bold: true, size: 12 };
  const resultCell = resultRow.getCell(2);
  resultCell.value = { formula: excelFormula.slice(1), result: sampleResult } as ExcelJS.CellFormulaValue;
  resultCell.numFmt = numberFormat(output.format, output.decimals);
  resultCell.font = { bold: true, size: 12 };
  resultCell.fill = RESULT_FILL;
  resultCell.border = BOX;
  resultRow.getCell(3).value = TYPE_LABEL[output.format as FieldType];
  resultRow.getCell(4).value = output.description;
  resultRow.getCell(4).alignment = { wrapText: true, vertical: 'top' };
  const resultName = uniqueResultName(output.name, new Set([...names.values()].map((n) => n.toUpperCase())));
  resultRow.getCell(5).value = resultName;
  wb.definedNames.add(`Model!$B$${row}`, resultName);

  row += 2;
  const notes: [string, string][] = [
    ['Formula', readableFormula],
    ['Excel formula', excelFormula],
    ['How to use', 'Change the yellow input cells. The result recalculates automatically.'],
  ];
  for (const [label, text] of notes) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF6B6B7B' } };
    ws.mergeCells(`B${row}:E${row}`);
    ws.getCell(`B${row}`).value = text; // Plain string: shown as text, never evaluated.
    ws.getCell(`B${row}`).alignment = { wrapText: true, vertical: 'top' };
    row++;
  }

  return wb;
}

function uniqueResultName(displayName: string, taken: Set<string>): string {
  const base = toExcelName(displayName);
  let candidate = base;
  for (let i = 2; taken.has(candidate.toUpperCase()); i++) candidate = `${base}_${i}`;
  return candidate;
}

export async function downloadXlsx(model: Model): Promise<void> {
  const buffer = await buildWorkbook(model).xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${model.name.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'cost-model'}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
