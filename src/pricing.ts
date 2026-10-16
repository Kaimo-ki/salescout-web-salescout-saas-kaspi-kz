import type { PriceResult, Product, Reason } from './types';

/** Calculates a safe price against the cheapest competitor currently in stock. */
export function calculatePrice(product: Product): PriceResult {
  const availableCompetitors = product.competitors.filter((competitor) => competitor.inStock);

  if (availableCompetitors.length === 0) {
    return {
      sku: product.sku,
      oldPrice: product.myPrice,
      newPrice: product.maxPrice,
      reason: 'NO_COMPETITORS',
    };
  }

  const bestPrice = Math.min(...availableCompetitors.map((competitor) => competitor.price));
  const candidate = Math.floor(bestPrice - product.step);
  let newPrice: number;
  let reason: Reason;

  if (candidate < product.minPrice) {
    newPrice = product.minPrice;
    reason = 'AT_MIN';
  } else if (candidate > product.maxPrice) {
    newPrice = product.maxPrice;
    reason = 'AT_MAX';
  } else {
    newPrice = candidate;
    reason = 'UNDERCUT';
  }

  return { sku: product.sku, oldPrice: product.myPrice, newPrice, reason };
}
