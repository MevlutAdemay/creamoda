/**
 * Finance page data shape (server → client).
 */

export type FinancePageData = {
  range: string;
  scope: string;
  scopeId?: string | null;
  category?: string | null;
  kpis: {
    net: number;
    totalIn: number;
    totalOut: number;
    biggestExpenseCategory?: string | null;
  };
  timeline: { dayKey: string; inUsd: number; outUsd: number; netUsd: number }[];
  expenseByCategory: { category: string; amount: number }[];
  buildingSummary: {
    buildingId: string;
    buildingName: string;
    buildingType: 'WAREHOUSE' | 'HQ';
    totalIn: number;
    totalOut: number;
    net: number;
  }[];
  tableRows: {
    id: string;
    dayKey: string;
    category: string;
    direction: 'IN' | 'OUT';
    amount: number;
    scopeLabel: string;
    refType?: string | null;
    note?: string | null;
    scopeType: string;
    scopeId?: string | null;
    idempotencyKey?: string | null;
    refId?: string | null;
  }[];
  ledgerHasMore?: boolean;
  ledgerNextCursor?: string | null;
  inbox?: {
    id: string;
    createdAt: string;
    title: string;
    body: string;
    category?: string;
  }[];
};
