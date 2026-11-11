import { QUOTES } from '../constants/quotes';

// Deterministic per calendar day (same quote all day, changes at local midnight).
// Consecutive days map to consecutive quotes, so adjacent days never repeat.
export function quoteForDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dayIndex = y * 372 + m * 31 + d;
  return QUOTES[dayIndex % QUOTES.length];
}
