/**
 * Price index and stepped multiplier for demand (Step A).
 * normalPrice = suggestedSalePrice * MarketZonePriceIndex.multiplier
 * priceIndex = salePrice / normalPrice
 * When normalPrice <= 0 or priceIndex is NaN/Infinity, treat as 1.0 (do not block).
 */

/**
 * Stepped price multiplier from priceIndex.
 * priceIndex > 1.15 => 0; > 1.10 => 0.60; > 1.05 => 0.85;
 * <= 0.70 => 1.30; <= 0.80 => 1.20; <= 0.90 => 1.10; else 1.00.
 */
export function getPriceMultiplier(priceIndex: number): number {
  if (priceIndex > 1.15) return 0;
  if (priceIndex > 1.1) return 0.6;
  if (priceIndex > 1.05) return 0.85;
  if (priceIndex <= 0.7) return 1.3;
  if (priceIndex <= 0.8) return 1.2;
  if (priceIndex <= 0.9) return 1.1;
  return 1;
}

/**
 * Compute priceIndex = salePrice / normalPrice.
 * normalPrice = suggestedSalePrice * multiplier.
 * Returns 1.0 when normalPrice <= 0 or result is NaN/Infinity (caller then uses priceMultiplier 1.0).
 */
export function computePriceIndex(
  salePrice: number,
  suggestedSalePrice: number,
  multiplier: number
): number {
  const normalPrice = suggestedSalePrice * multiplier;
  if (normalPrice <= 0) return 1;
  const priceIndex = salePrice / normalPrice;
  if (!Number.isFinite(priceIndex)) return 1;
  return priceIndex;
}
