export interface ParsedShop {
  name: string;
  counter: number;
  /** column index in the sheet; used to key per-product issue quantities */
  col: number;
}

export interface ParsedProduct {
  row: number;
  sku: string;
  name: string;
  description: string;
  mrp: number;
  sellingPrice: number;
  discount: number;
  minThreshold: number;
  isActive: boolean;
  stockQty: number;
  /** shop column index -> quantity to issue */
  issues: Record<string, number>;
}

export interface ParsedCategory {
  name: string;
  description: string;
  sheet: string;
  shops: ParsedShop[];
  products: ParsedProduct[];
}

export interface ParsedFile {
  categories: ParsedCategory[];
}

export type Status = 'NEW' | 'EXISTS' | 'CONFLICT';

export interface PlanRow {
  key: string;
  category: string;
  cells: (string | number)[];
  status: Status;
  note?: string;
  /** request body (null when a prerequisite is still missing) */
  payload?: any;
  /** shop id, used to group issue calls */
  groupId?: number;
}

export interface StepPlan {
  rows: PlanRow[];
  newCount: number;
  conflictCount: number;
  existsCount: number;
  /** nothing left to create and nothing in conflict */
  complete: boolean;
}

export interface Live {
  categories: any[];
  products: any[];
  shops: any[];
  stocks: any[];
  issues: any[];
}
