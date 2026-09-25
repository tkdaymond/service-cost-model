import type { AppEdge, AppNode, Field, Model } from './types';

export const OUTPUT_NODE_ID = 'output';

export const DEFAULT_FIELDS: Field[] = [
  { id: 'hours', name: 'Hours', description: 'Number of service hours', type: 'number', icon: 'hash', group: 'Service Inputs', sampleValue: 40 },
  { id: 'hourlyRate', name: 'Hourly Rate', description: 'Standard hourly rate', type: 'currency', icon: 'dollar', group: 'Service Inputs', sampleValue: 85 },
  { id: 'teamSize', name: 'Team Size', description: 'Number of team members', type: 'number', icon: 'user', group: 'Service Inputs', sampleValue: 2 },
  { id: 'locationMultiplier', name: 'Location Multiplier', description: 'Regional cost adjustment', type: 'number', icon: 'pin', group: 'Service Inputs', sampleValue: 1.1 },
  { id: 'serviceLevel', name: 'Service Level', description: 'Multiplier, e.g. 1.0 Standard, 1.25 Premium', type: 'number', icon: 'list', group: 'Service Inputs', sampleValue: 1 },
  { id: 'materialCost', name: 'Material Cost', description: 'Direct material cost', type: 'currency', icon: 'box', group: 'Cost Components', sampleValue: 1200 },
  { id: 'travelCost', name: 'Travel Cost', description: 'Estimated travel cost', type: 'currency', icon: 'plane', group: 'Cost Components', sampleValue: 250 },
  { id: 'overheadRate', name: 'Overhead Rate', description: 'Percentage of overhead', type: 'percent', icon: 'percent', group: 'Cost Components', sampleValue: 0.15 },
  { id: 'profitMargin', name: 'Profit Margin', description: 'Target margin percentage', type: 'percent', icon: 'percent', group: 'Cost Components', sampleValue: 0.2 },
];

const DEFAULT_NODES: AppNode[] = [
  { id: 'n-hours', type: 'field', position: { x: 0, y: 0 }, data: { fieldId: 'hours' } },
  { id: 'n-rate', type: 'field', position: { x: 300, y: 0 }, data: { fieldId: 'hourlyRate' } },
  { id: 'n-labor', type: 'operator', position: { x: 150, y: 150 }, data: { op: 'multiply', label: 'Multiply', subtitle: 'Service Labor Cost' } },
  { id: 'n-material', type: 'field', position: { x: 480, y: 160 }, data: { fieldId: 'materialCost' } },
  { id: 'n-direct', type: 'operator', position: { x: 300, y: 310 }, data: { op: 'add', label: 'Add', subtitle: 'Direct Cost' } },
  { id: 'n-overhead-rate', type: 'field', position: { x: 0, y: 440 }, data: { fieldId: 'overheadRate' } },
  { id: 'n-overhead', type: 'percent', position: { x: 300, y: 440 }, data: { mode: 'markup', label: 'Apply Markup', subtitle: 'Add Overhead' } },
  { id: 'n-margin-rate', type: 'field', position: { x: 0, y: 580 }, data: { fieldId: 'profitMargin' } },
  { id: 'n-margin', type: 'percent', position: { x: 300, y: 580 }, data: { mode: 'margin', label: 'Apply Margin', subtitle: 'Add Profit Margin' } },
  {
    id: OUTPUT_NODE_ID,
    type: 'output',
    position: { x: 290, y: 730 },
    deletable: false,
    data: {
      name: 'Total Service Cost',
      description: 'Final calculated cost including labor, materials, overhead, and profit margin.',
      format: 'currency',
      decimals: 2,
    },
  },
];

function edge(source: string, target: string, targetHandle: string, sourceHandle = 'out'): AppEdge {
  return { id: `e-${source}-${target}-${targetHandle}`, source, target, sourceHandle, targetHandle };
}

const DEFAULT_EDGES: AppEdge[] = [
  edge('n-hours', 'n-labor', 'in'),
  edge('n-rate', 'n-labor', 'in'),
  edge('n-labor', 'n-direct', 'in'),
  edge('n-material', 'n-direct', 'in'),
  edge('n-direct', 'n-overhead', 'base'),
  edge('n-overhead-rate', 'n-overhead', 'rate', 'out-right'),
  edge('n-overhead', 'n-margin', 'base'),
  edge('n-margin-rate', 'n-margin', 'rate', 'out-right'),
  edge('n-margin', OUTPUT_NODE_ID, 'in'),
];

export function defaultModel(): Model {
  return structuredClone({
    name: 'Service Cost Model',
    description: 'Define the calculation logic for service costs',
    fields: DEFAULT_FIELDS,
    nodes: DEFAULT_NODES,
    edges: DEFAULT_EDGES,
  });
}
