import { describe, expect, it } from 'vitest';
import { calculatePrice } from './pricing';
import type { Product } from './types';

const baseProduct: Product = {
  sku: 'DEMO-1',
  name: 'Демо-товар',
  myPrice: 400_000,
  minPrice: 370_000,
  maxPrice: 420_000,
  step: 10,
  competitors: [{ seller: 'Конкурент', price: 384_990, inStock: true }],
};

describe('calculatePrice', () => {
  it('undercuts the cheapest in-stock competitor', () => {
    expect(calculatePrice(baseProduct)).toEqual({ sku: 'DEMO-1', oldPrice: 400_000, newPrice: 384_980, reason: 'UNDERCUT' });
  });

  it('ignores competitors that are out of stock', () => {
    expect(calculatePrice({ ...baseProduct, competitors: [{ seller: 'Нет в наличии', price: 1, inStock: false }] })).toMatchObject({ newPrice: 420_000, reason: 'NO_COMPETITORS' });
  });

  it('clamps the candidate to the minimum price', () => {
    expect(calculatePrice({ ...baseProduct, minPrice: 180_000, maxPrice: 210_000, step: 100, competitors: [{ seller: 'Конкурент', price: 175_000, inStock: true }] })).toMatchObject({ newPrice: 180_000, reason: 'AT_MIN' });
  });

  it('clamps the candidate to the maximum price', () => {
    expect(calculatePrice({ ...baseProduct, minPrice: 100_000, maxPrice: 125_000, step: 1, competitors: [{ seller: 'Конкурент', price: 150_000, inStock: true }] })).toMatchObject({ newPrice: 125_000, reason: 'AT_MAX' });
  });

  it('rounds fractional candidates down', () => {
    expect(calculatePrice({ ...baseProduct, step: 0.5, competitors: [{ seller: 'Конкурент', price: 349_999.9, inStock: true }] })).toMatchObject({ newPrice: 349_999, reason: 'UNDERCUT' });
  });
});
