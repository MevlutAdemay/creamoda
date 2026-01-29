// types.ts
// Shared lightweight types used by UI components.

export interface Product {
  id: string;
  code?: string;
  name: string;
  title: string;
  price?: number;
  description?: string;
  category?: string;
  imageUrl?: string;
  imageUrls?: string[];
  unlockCostXp?: number | null;
  unlockCostDiamond?: number | null;
  // Allow feature flags without tightening UI coupling.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

