// src/utils/prices.ts
const PRICE_PER_G: Record<string, number> = {
  chicken: 0.009,
  rice: 0.002,
  oats: 0.003,
  banana: 0.004,
  apple: 0.004,
  egg: 0.002,
  milk: 0.0015,
  yogurt: 0.0025,
  bread: 0.003,
  pasta: 0.002,
  beans: 0.0025,
  tuna: 0.01,
  peanut: 0.006,
  "peanut butter": 0.007,
  oil: 0.01,
  olive: 0.01,
  broccoli: 0.005,
  spinach: 0.006,
  tomato: 0.004,
  onion: 0.003,
};

function matchKey(name: string): string | null {
  const k = name.toLowerCase();
  const keys = Object.keys(PRICE_PER_G);
  for (const key of keys) {
    if (k.includes(key)) return key;
  }
  return null;
}

export function pricePerGram(name: string): number {
  const key = matchKey(name);
  if (key) return PRICE_PER_G[key];
  return 0.004; // default guess $4/kg
}

export function estimateListCost(items: { name: string; grams?: number }[]): number {
  let total = 0;
  for (const it of items) {
    const g = Math.max(0, Math.round(it.grams || 0));
    const p = pricePerGram(it.name);
    total += g * p;
  }
  return Math.round(total * 100) / 100;
}