import type { AppNode } from './types';

export interface TargetHandle {
  id: string;
  /** Whether the handle accepts more than one incoming connection. */
  multi: boolean;
  /** Short label drawn next to the handle when order matters. */
  label?: string;
}

/** Input handles for each node kind. The compiler and the canvas both rely on these ids. */
export function targetHandles(node: AppNode): TargetHandle[] {
  switch (node.type) {
    case 'field':
    case 'constant':
      return [];
    case 'operator':
      return node.data.op === 'add' || node.data.op === 'multiply'
        ? [{ id: 'in', multi: true }]
        : [
            { id: 'a', multi: false, label: 'A' },
            { id: 'b', multi: false, label: 'B' },
          ];
    case 'percent':
      return [
        { id: 'base', multi: false, label: 'Base' },
        { id: 'rate', multi: false, label: 'Rate' },
      ];
    case 'function':
      return [{ id: 'in', multi: node.data.fn !== 'round' }];
    case 'output':
      return [{ id: 'in', multi: false }];
  }
}

export function hasSource(node: AppNode): boolean {
  return node.type !== 'output';
}
