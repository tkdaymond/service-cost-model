import type { LucideIcon } from 'lucide-react';
import { Binary, Percent } from 'lucide-react';
import { FN_ICONS, OP_ICONS } from './icons';
import type { AppNode } from './types';

export interface PaletteItem {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  node: Omit<AppNode, 'id' | 'position'>;
}

export const OPERATORS: PaletteItem[] = [
  { key: 'add', label: 'Add', description: 'Sum of all inputs', icon: OP_ICONS.add, node: { type: 'operator', data: { op: 'add', label: 'Add', subtitle: 'Sum' } } },
  { key: 'subtract', label: 'Subtract', description: 'A minus B', icon: OP_ICONS.subtract, node: { type: 'operator', data: { op: 'subtract', label: 'Subtract', subtitle: 'A − B' } } },
  { key: 'multiply', label: 'Multiply', description: 'Product of all inputs', icon: OP_ICONS.multiply, node: { type: 'operator', data: { op: 'multiply', label: 'Multiply', subtitle: 'Product' } } },
  { key: 'divide', label: 'Divide', description: 'A divided by B', icon: OP_ICONS.divide, node: { type: 'operator', data: { op: 'divide', label: 'Divide', subtitle: 'A ÷ B' } } },
  { key: 'markup', label: 'Apply Markup', description: 'Base × (1 + rate), e.g. overhead', icon: Percent, node: { type: 'percent', data: { mode: 'markup', label: 'Apply Markup', subtitle: '+ % of cost' } } },
  { key: 'margin', label: 'Apply Margin', description: 'Base ÷ (1 − rate), e.g. profit margin', icon: Percent, node: { type: 'percent', data: { mode: 'margin', label: 'Apply Margin', subtitle: '% of price' } } },
  { key: 'constant', label: 'Constant', description: 'A fixed number', icon: Binary, node: { type: 'constant', data: { value: 1, label: 'Constant' } } },
];

export const FUNCTIONS: PaletteItem[] = [
  { key: 'min', label: 'Min', description: 'Smallest of the inputs', icon: FN_ICONS.min, node: { type: 'function', data: { fn: 'min', label: 'Min', subtitle: 'Lowest value', digits: 0 } } },
  { key: 'max', label: 'Max', description: 'Largest of the inputs, e.g. a minimum charge', icon: FN_ICONS.max, node: { type: 'function', data: { fn: 'max', label: 'Max', subtitle: 'Highest value', digits: 0 } } },
  { key: 'round', label: 'Round', description: 'Round to a number of decimals', icon: FN_ICONS.round, node: { type: 'function', data: { fn: 'round', label: 'Round', subtitle: '2 decimals', digits: 2 } } },
];

/** MIME type used to carry palette items through HTML drag and drop. */
export const DND_TYPE = 'application/x-cost-model-node';
