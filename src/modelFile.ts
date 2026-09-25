import { OUTPUT_NODE_ID } from './defaults';
import type { AppNode, Model } from './types';

const FORMAT = 'service-cost-model';
const VERSION = 1;

interface ModelFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  model: Model;
}

export function serializeModel(model: Model): string {
  const file: ModelFile = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), model };
  return JSON.stringify(file, null, 2);
}

const NODE_TYPES = new Set<AppNode['type']>(['field', 'operator', 'percent', 'function', 'constant', 'output']);
const FIELD_TYPES = new Set(['number', 'currency', 'percent']);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Parses and checks a model file. Throws an Error with a user-readable message when the file is not usable.
 * Only structure is checked here; graph problems (missing inputs etc.) are reported by the compiler as usual.
 */
export function parseModelFile(text: string): Model {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!isObj(data) || data.format !== FORMAT) throw new Error('This is not a Service Cost Model file.');
  if (!isNum(data.version) || data.version > VERSION) {
    throw new Error('This file was made by a newer version of the app.');
  }
  const m = data.model;
  if (!isObj(m) || !Array.isArray(m.fields) || !Array.isArray(m.nodes) || !Array.isArray(m.edges)) {
    throw new Error('The file is missing its fields, nodes or connections.');
  }

  m.fields.forEach((f, i) => {
    if (!isObj(f) || !isStr(f.id) || !isStr(f.name) || !FIELD_TYPES.has(f.type as string) || !isNum(f.sampleValue)) {
      throw new Error(`Field ${i + 1} in the file is incomplete or invalid.`);
    }
  });
  m.nodes.forEach((n, i) => {
    if (!isObj(n) || !isStr(n.id) || !NODE_TYPES.has(n.type as AppNode['type']) || !isObj(n.data) || !isObj(n.position)) {
      throw new Error(`Node ${i + 1} in the file is incomplete or invalid.`);
    }
  });
  m.edges.forEach((e, i) => {
    if (!isObj(e) || !isStr(e.id) || !isStr(e.source) || !isStr(e.target)) {
      throw new Error(`Connection ${i + 1} in the file is incomplete or invalid.`);
    }
  });

  const model = m as unknown as Model;
  return {
    name: isStr(model.name) ? model.name : 'Imported model',
    description: isStr(model.description) ? model.description : '',
    // Fill optional field properties so older or hand-edited files still render.
    fields: model.fields.map((f) => ({ ...f, description: f.description ?? '', group: f.group ?? 'Other', icon: f.icon ?? 'hash' })),
    // The result node must stay undeletable, whatever the file says.
    nodes: model.nodes.map((n) => (n.id === OUTPUT_NODE_ID || n.type === 'output' ? { ...n, deletable: false } : n)),
    edges: model.edges,
  };
}

export function downloadModelFile(model: Model): void {
  const blob = new Blob([serializeModel(model)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${model.name.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'cost-model'}.costmodel.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
