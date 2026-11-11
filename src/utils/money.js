// Money is stored as integer paise (1 rupee = 100 paise). Never use floats for stored amounts.

const MAX_RUPEES_DIGITS = 9;

// Parses user input such as "1,234.50", "₹ 99", "5." into integer paise, or null if invalid.
// Parsed from the string directly so there is no floating-point rounding.
export function parseRupeesToPaise(input) {
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[₹,\s]/g, '');
  const m = new RegExp(`^(\\d{1,${MAX_RUPEES_DIGITS}})(?:\\.(\\d{0,2}))?$`).exec(cleaned);
  if (!m) return null;
  const frac = (m[2] ?? '').padEnd(2, '0');
  return Number(m[1]) * 100 + Number(frac);
}

// Indian digit grouping: 1234567 -> "12,34,567".
function groupIndian(digits) {
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return [...parts, lastThree].join(',');
}

// Decimals are shown only when needed: ₹1,250 or ₹1,250.50.
export function formatPaise(paise) {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const remainder = abs % 100;
  let text = groupIndian(String(rupees));
  if (remainder) text += `.${String(remainder).padStart(2, '0')}`;
  return `${negative ? '-' : ''}₹${text}`;
}
