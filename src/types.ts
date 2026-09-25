import type { Edge, Node } from '@xyflow/react';

export type FieldType = 'number' | 'currency' | 'percent';

export type IconName =
  | 'hash'
  | 'dollar'
  | 'user'
  | 'pin'
  | 'list'
  | 'box'
  | 'plane'
  | 'percent'
  | 'clock'
  | 'truck'
  | 'wrench';

/** A reusable input variable. Percent values are stored as fractions (0.15 = 15%). */
export interface Field {
  id: string;
  name: string;
  description: string;
  type: FieldType;
  icon: IconName;
  group: string;
  sampleValue: number;
}

export type BinaryOp = 'subtract' | 'divide';
export type NaryOp = 'add' | 'multiply';
export type FunctionName = 'min' | 'max' | 'round';
export type PercentMode = 'markup' | 'margin';
export type OutputFormat = 'currency' | 'number' | 'percent';

export interface FieldNodeData {
  fieldId: string;
  [key: string]: unknown;
}

export interface OperatorNodeData {
  op: NaryOp | BinaryOp;
  label: string;
  subtitle: string;
  [key: string]: unknown;
}

export interface PercentNodeData {
  mode: PercentMode;
  label: string;
  subtitle: string;
  [key: string]: unknown;
}

export interface FunctionNodeData {
  fn: FunctionName;
  label: string;
  subtitle: string;
  /** Only used by ROUND. */
  digits: number;
  [key: string]: unknown;
}

export interface ConstantNodeData {
  value: number;
  label: string;
  [key: string]: unknown;
}

export interface OutputNodeData {
  name: string;
  description: string;
  format: OutputFormat;
  decimals: number;
  [key: string]: unknown;
}

export type FieldNode = Node<FieldNodeData, 'field'>;
export type OperatorNode = Node<OperatorNodeData, 'operator'>;
export type PercentNode = Node<PercentNodeData, 'percent'>;
export type FunctionNode = Node<FunctionNodeData, 'function'>;
export type ConstantNode = Node<ConstantNodeData, 'constant'>;
export type OutputNode = Node<OutputNodeData, 'output'>;

export type AppNode = FieldNode | OperatorNode | PercentNode | FunctionNode | ConstantNode | OutputNode;
export type AppEdge = Edge;

export interface Model {
  name: string;
  description: string;
  fields: Field[];
  nodes: AppNode[];
  edges: AppEdge[];
}
