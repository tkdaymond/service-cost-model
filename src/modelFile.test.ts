import { describe, expect, it } from 'vitest';
import { compileModel } from './compiler';
import { defaultModel } from './defaults';
import { parseModelFile, serializeModel } from './modelFile';

describe('model files', () => {
  it('round-trips a model', () => {
    const model = defaultModel();
    const parsed = parseModelFile(serializeModel(model));
    expect(parsed.fields).toEqual(model.fields);
    expect(parsed.edges).toEqual(model.edges);
    expect(compileModel(parsed).errors).toEqual([]);
  });

  it('rejects files that are not models', () => {
    expect(() => parseModelFile('not json')).toThrow(/not valid JSON/);
    expect(() => parseModelFile('{"hello":1}')).toThrow(/not a Service Cost Model file/);
    expect(() => parseModelFile(JSON.stringify({ format: 'service-cost-model', version: 99, model: {} }))).toThrow(/newer version/);
  });

  it('rejects broken contents with a specific message', () => {
    const file = JSON.parse(serializeModel(defaultModel()));
    file.model.fields[2].type = 'banana';
    expect(() => parseModelFile(JSON.stringify(file))).toThrow(/Field 3/);
  });

  it('keeps the result node undeletable', () => {
    const file = JSON.parse(serializeModel(defaultModel()));
    for (const n of file.model.nodes) delete n.deletable;
    const out = parseModelFile(JSON.stringify(file)).nodes.find((n) => n.type === 'output')!;
    expect(out.deletable).toBe(false);
  });
});
