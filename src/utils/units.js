export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 300;
export const MAX_WATER_ML_PER_LOG = 5000;

// Returns kilograms rounded to 2 decimals, or null if the text is not a plausible weight.
export function parseKg(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const kg = Number(cleaned);
  if (kg < MIN_WEIGHT_KG || kg > MAX_WEIGHT_KG) return null;
  return Math.round(kg * 100) / 100;
}

export function parseMl(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim();
  if (!/^\d{1,4}$/.test(cleaned)) return null;
  const ml = Number(cleaned);
  return ml >= 1 && ml <= MAX_WATER_ML_PER_LOG ? ml : null;
}

export function formatKg(kg) {
  return `${Number(kg.toFixed(2))} kg`;
}

export function formatMl(ml) {
  return ml >= 1000 ? `${Number((ml / 1000).toFixed(2))} L` : `${ml} ml`;
}
