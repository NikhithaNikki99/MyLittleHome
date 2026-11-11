import { buildMonthGrid } from '../src/utils/calendarGrid';
import { formatMonthKey, monthKeyOf, shiftMonth } from '../src/utils/dates';

describe('buildMonthGrid', () => {
  test('November 2026 starts on Sunday and fills five weeks', () => {
    const weeks = buildMonthGrid('2026-11');
    expect(weeks.length).toBe(5);
    expect(weeks[0][0]).toEqual({ dateKey: '2026-11-01', day: 1, inMonth: true });
    expect(weeks[4][1]).toEqual({ dateKey: '2026-11-30', day: 30, inMonth: true });
    expect(weeks[4][2].inMonth).toBe(false);
  });

  test('every row has seven cells, and leading cells come from the previous month', () => {
    const weeks = buildMonthGrid('2026-05'); // May 1 2026 is a Friday
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0].slice(0, 5).map((c) => c.inMonth)).toEqual([false, false, false, false, false]);
    expect(weeks[0][0].dateKey).toBe('2026-04-26');
    expect(weeks[0][5]).toEqual({ dateKey: '2026-05-01', day: 1, inMonth: true });
  });

  test('February in a leap year has 29 in-month days', () => {
    const days = buildMonthGrid('2024-02').flat().filter((c) => c.inMonth);
    expect(days.length).toBe(29);
  });

  test('a month can need six rows', () => {
    expect(buildMonthGrid('2026-08').length).toBe(6); // Aug 1 2026 is a Saturday
  });
});

describe('month switching', () => {
  test('crosses year boundaries both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 0)).toBe('2026-11');
    expect(shiftMonth('2026-03', -15)).toBe('2024-12');
  });
  test('formats a month key for display', () => {
    expect(formatMonthKey('2026-11')).toMatch(/Nov/);
    expect(monthKeyOf('2026-11-11')).toBe('2026-11');
  });
});
