import { QUOTES } from '../src/constants/quotes';
import {
  addDays,
  greetingFor,
  isValidDateKey,
  monthRange,
  parseDateKey,
  toDateKey,
  weekdayOf,
} from '../src/utils/dates';
import { formatPaise, parseRupeesToPaise } from '../src/utils/money';
import { quoteForDate } from '../src/utils/quotes';
import { formatKg, formatMl, parseKg, parseMl } from '../src/utils/units';

describe('dates', () => {
  test('toDateKey uses local calendar fields, not UTC', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });

  test('isValidDateKey rejects malformed and impossible dates', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(isValidDateKey('2024-02-29')).toBe(true);
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('2026-1-1')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
    expect(() => parseDateKey('nope')).toThrow(/Invalid date key/);
  });

  test('addDays crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-05-10', -6)).toBe('2026-05-04');
  });

  test('addDays is stable across a long span (DST-safe calendar arithmetic)', () => {
    let key = '2026-01-01';
    for (let i = 0; i < 365; i++) key = addDays(key, 1);
    expect(key).toBe('2027-01-01');
  });

  test('weekdayOf matches the calendar (0 = Sunday)', () => {
    expect(weekdayOf('2026-11-11')).toBe(3);
    expect(weekdayOf('2026-11-15')).toBe(0);
  });

  test('monthRange is a half-open range including December rollover', () => {
    expect(monthRange('2026-11-11')).toEqual({ start: '2026-11-01', endExclusive: '2026-12-01' });
    expect(monthRange('2026-12-31')).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' });
    expect(monthRange('2024-02-29')).toEqual({ start: '2024-02-01', endExclusive: '2024-03-01' });
  });

  test('greetingFor follows the hour of day', () => {
    const at = (h) => greetingFor(new Date(2026, 0, 1, h));
    expect(at(3)).toBe('Still up?');
    expect(at(8)).toBe('Good morning');
    expect(at(14)).toBe('Good afternoon');
    expect(at(19)).toBe('Good evening');
    expect(at(22)).toBe('Good night');
  });
});

describe('money', () => {
  test('parses rupees to integer paise without float error', () => {
    expect(parseRupeesToPaise('250')).toBe(25000);
    expect(parseRupeesToPaise('1,234.50')).toBe(123450);
    expect(parseRupeesToPaise('₹ 99')).toBe(9900);
    expect(parseRupeesToPaise('0.07')).toBe(7);
    expect(parseRupeesToPaise('19.9')).toBe(1990);
    expect(parseRupeesToPaise('5.')).toBe(500);
    expect(parseRupeesToPaise('1.1')).toBe(110);
  });

  test('rejects invalid money input', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e3', '1.2.3', '9999999999', null, undefined, 12]) {
      expect(parseRupeesToPaise(bad)).toBeNull();
    }
  });

  test('formats INR with Indian grouping and optional decimals', () => {
    expect(formatPaise(0)).toBe('₹0');
    expect(formatPaise(99900)).toBe('₹999');
    expect(formatPaise(125000)).toBe('₹1,250');
    expect(formatPaise(125050)).toBe('₹1,250.50');
    expect(formatPaise(100000000)).toBe('₹10,00,000');
    expect(formatPaise(123456789)).toBe('₹12,34,567.89');
    expect(formatPaise(5)).toBe('₹0.05');
    expect(formatPaise(-25000)).toBe('-₹250');
  });
});

describe('units', () => {
  test('parseKg accepts plausible weights and normalises commas', () => {
    expect(parseKg('62.5')).toBe(62.5);
    expect(parseKg('62,5')).toBe(62.5);
    expect(parseKg(' 70 ')).toBe(70);
    expect(parseKg('19.9')).toBeNull();
    expect(parseKg('301')).toBeNull();
    expect(parseKg('62.555')).toBeNull();
    expect(parseKg('abc')).toBeNull();
  });

  test('parseMl accepts whole millilitres in a sane range', () => {
    expect(parseMl('250')).toBe(250);
    expect(parseMl('0')).toBeNull();
    expect(parseMl('5001')).toBeNull();
    expect(parseMl('12.5')).toBeNull();
    expect(parseMl('')).toBeNull();
  });

  test('formats weight and water', () => {
    expect(formatKg(62.5)).toBe('62.5 kg');
    expect(formatKg(70)).toBe('70 kg');
    expect(formatMl(750)).toBe('750 ml');
    expect(formatMl(1500)).toBe('1.5 L');
    expect(formatMl(2000)).toBe('2 L');
  });
});

describe('daily quote', () => {
  test('is stable within a day and always a bundled quote', () => {
    expect(quoteForDate('2026-11-11')).toBe(quoteForDate('2026-11-11'));
    expect(QUOTES).toContain(quoteForDate('2026-11-11'));
  });

  test('consecutive days never repeat the same quote', () => {
    let key = '2026-01-01';
    for (let i = 0; i < 400; i++) {
      const next = addDays(key, 1);
      expect(quoteForDate(next)).not.toBe(quoteForDate(key));
      key = next;
    }
  });

  test('quotes are unique and non-empty', () => {
    expect(new Set(QUOTES).size).toBe(QUOTES.length);
    expect(QUOTES.every((q) => q.trim().length > 0)).toBe(true);
  });
});
