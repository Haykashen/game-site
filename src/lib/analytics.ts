import type { Lot } from '../types';

export interface PriceAnalytics {
  min: number;
  max: number;
  avg: number;
  /** Width of the gradient track on the 0–100 scale. */
  fillWidth: number;
  /** Position of the average marker on the 0–100 scale. */
  averagePosition: number;
}

/**
 * Single place for the price maths. It intentionally mirrors the original
 * behaviour: sale and purchase lots both contribute to min / average / max.
 */
export function calculatePriceAnalytics(lots: readonly Lot[]): PriceAnalytics {
  if (lots.length === 0) {
    return { min: 0, max: 0, avg: 0, fillWidth: 0, averagePosition: 0 };
  }

  const prices = lots.map((lot) => lot.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = Math.round(prices.reduce((total, price) => total + price, 0) / prices.length);

  if (min === max) {
    return { min, max, avg, fillWidth: 100, averagePosition: 50 };
  }

  return {
    min,
    max,
    avg,
    fillWidth: 100,
    averagePosition: ((avg - min) / (max - min)) * 100,
  };
}
