import type { Field } from './types';

const RESERVED = new Set(['TRUE', 'FALSE']);

/** Names Excel would read as an A1 cell reference (up to column XFD, row 1048576). */
function looksLikeA1(name: string): boolean {
  const m = /^([A-Za-z]{1,3})(\d{1,7})$/.exec(name);
  if (!m) return false;
  const col = m[1].toUpperCase().split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
  const row = Number(m[2]);
  return col <= 16384 && row >= 1 && row <= 1048576;
}

/** Names Excel would read as an R1C1 reference, including bare "R" and "C". */
function looksLikeR1C1(name: string): boolean {
  return /^(R\d*C\d*|R\d*|C\d*)$/i.test(name);
}

/** Converts a display name like "Hourly Rate" into a legal Excel defined name like "Hourly_Rate". */
export function toExcelName(displayName: string): string {
  let name = displayName
    .trim()
    .replace(/%/g, 'Pct')
    .replace(/[^A-Za-z0-9_.]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!name) name = 'Field';
  if (!/^[A-Za-z_]/.test(name)) name = `_${name}`;
  if (looksLikeA1(name) || looksLikeR1C1(name) || RESERVED.has(name.toUpperCase())) name = `${name}_`;
  return name.slice(0, 255);
}

/** Assigns every field a unique Excel name. Excel names are case-insensitive, so uniqueness is too. */
export function excelNamesFor(fields: Field[]): Map<string, string> {
  const result = new Map<string, string>();
  const taken = new Set<string>();
  for (const field of fields) {
    const base = toExcelName(field.name);
    let candidate = base;
    for (let i = 2; taken.has(candidate.toUpperCase()); i++) candidate = `${base}_${i}`;
    taken.add(candidate.toUpperCase());
    result.set(field.id, candidate);
  }
  return result;
}
