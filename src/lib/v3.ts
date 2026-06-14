export const V3_CURRENT_PRICE = 1850;

export interface LiquidityBar {
  price: number;
  liquidity: number;
}

/** Bell-curve-ish liquidity distribution around the current price (simulated). */
export function generateLiquidityData(currentPrice = V3_CURRENT_PRICE): LiquidityBar[] {
  const data: LiquidityBar[] = [];
  const center = currentPrice;
  const spread = center * 0.6;
  const numBars = 80;
  const minPrice = center - spread;
  const maxPrice = center + spread;
  const step = (maxPrice - minPrice) / numBars;

  for (let i = 0; i < numBars; i++) {
    const price = minPrice + step * i;
    const x = (price - center) / (spread * 0.35);
    const main = Math.exp(-0.5 * x * x);
    const secondary = 0.3 * Math.exp((-0.5 * Math.pow(x - 0.8, 2)) / 0.15);
    const tertiary = 0.2 * Math.exp((-0.5 * Math.pow(x + 0.6, 2)) / 0.1);
    const noise = 0.05 * Math.random();
    const liquidity = (main + secondary + tertiary + noise) * (50 + Math.random() * 30);
    data.push({ price: Math.round(price), liquidity: Math.max(0, liquidity) });
  }
  return data;
}
