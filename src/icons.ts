import {
  Box,
  Clock,
  DollarSign,
  Divide,
  Hash,
  List,
  MapPin,
  Minus,
  Percent,
  Plane,
  Plus,
  Sigma,
  Truck,
  User,
  Wrench,
  X,
  ArrowDownToLine,
  ArrowUpToLine,
  CircleDot,
  Binary,
  type LucideIcon,
} from 'lucide-react';
import type { AppNode, FunctionName, IconName, NaryOp, BinaryOp } from './types';

export const FIELD_ICONS: Record<IconName, LucideIcon> = {
  hash: Hash,
  dollar: DollarSign,
  user: User,
  pin: MapPin,
  list: List,
  box: Box,
  plane: Plane,
  percent: Percent,
  clock: Clock,
  truck: Truck,
  wrench: Wrench,
};

export const OP_ICONS: Record<NaryOp | BinaryOp, LucideIcon> = {
  add: Plus,
  subtract: Minus,
  multiply: X,
  divide: Divide,
};

export const FN_ICONS: Record<FunctionName, LucideIcon> = {
  min: ArrowDownToLine,
  max: ArrowUpToLine,
  round: CircleDot,
};

export function nodeIcon(node: AppNode, fieldIcon?: IconName): LucideIcon {
  switch (node.type) {
    case 'field':
      return FIELD_ICONS[fieldIcon ?? 'hash'];
    case 'operator':
      return OP_ICONS[node.data.op];
    case 'percent':
      return Percent;
    case 'function':
      return FN_ICONS[node.data.fn];
    case 'constant':
      return Binary;
    case 'output':
      return Sigma;
  }
}
