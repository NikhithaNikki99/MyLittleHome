import {
  average,
  describeWeightChange,
  fillSeries,
  formatDuration,
  lastNDays,
  parseDuration,
  relativeDayLabel,
  splitDuration,
  weightGoalProgress,
} from '../src/features/wellness/wellnessStats';

describe('lastNDays and fillSeries', () => {
  test('lastNDays is oldest first and crosses month ends', () => {
    expect(lastNDays('2026-12-02', 4)).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
    expect(lastNDays('2026-11-11', 1)).toEqual(['2026-11-11']);
  });

  test('fillSeries uses the fill value for gaps', () => {
    const keys = ['2026-11-09', '2026-11-10', '2026-11-11'];
    const rows = [{ d: '2026-11-10', v: 5 }];
    expect(fillSeries(keys, rows, 'd', 'v', 0).map((x) => x.value)).toEqual([0, 5, 0]);
    expect(fillSeries(keys, rows, 'd', 'v', null).map((x) => x.value)).toEqual([null, 5, null]);
  });

  test('a stored 0 is kept, not replaced by the fill', () => {
    expect(fillSeries(['2026-11-10'], [{ d: '2026-11-10', v: 0 }], 'd', 'v', null)[0].value).toBe(0);
  });
});

describe('durations', () => {
  test('formatDuration', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(450)).toBe('7 h 30 min');
    expect(formatDuration(1440)).toBe('24 h');
  });

  test('parseDuration accepts hours and/or minutes and rejects the rest', () => {
    expect(parseDuration('7', '30')).toBe(450);
    expect(parseDuration('8', '')).toBe(480);
    expect(parseDuration('', '45')).toBe(45);
    expect(parseDuration(' 7 ', ' 05 ')).toBe(425);
    expect(parseDuration('24', '0')).toBe(1440);
    expect(parseDuration('', '')).toBeNull();
    expect(parseDuration('0', '0')).toBeNull();
    expect(parseDuration('7', '60')).toBeNull();
    expect(parseDuration('25', '0')).toBeNull();
    expect(parseDuration('24', '1')).toBeNull();
    expect(parseDuration('7.5', '')).toBeNull();
    expect(parseDuration('-1', '')).toBeNull();
    expect(parseDuration('abc', '')).toBeNull();
  });

  test('splitDuration', () => {
    expect(splitDuration(450)).toEqual({ hours: 7, minutes: 30 });
  });
});

describe('average', () => {
  test('ignores nulls (not logged), keeps zeros', () => {
    expect(average([null, 400, null, 500])).toBe(450);
    expect(average([0, 0, 600])).toBe(200);
    expect(average([null, null])).toBeNull();
    expect(average([])).toBeNull();
  });
});

describe('weight wording and goal progress', () => {
  test('describeWeightChange is signed and neutral', () => {
    expect(describeWeightChange(0)).toBe('No change');
    expect(describeWeightChange(0.004)).toBe('No change');
    expect(describeWeightChange(1.256)).toBe('+1.26 kg');
    expect(describeWeightChange(-0.5)).toBe('−0.5 kg');
  });

  test('goal progress toward a lower goal', () => {
    expect(weightGoalProgress({ startKg: 80, currentKg: 75, goalKg: 70 })).toEqual({ fraction: 0.5, remainingKg: 5 });
    expect(weightGoalProgress({ startKg: 80, currentKg: 69, goalKg: 70 })).toEqual({ fraction: 1, remainingKg: 0 });
    expect(weightGoalProgress({ startKg: 80, currentKg: 82, goalKg: 70 })).toEqual({ fraction: 0, remainingKg: 12 });
  });

  test('goal progress toward a higher goal', () => {
    expect(weightGoalProgress({ startKg: 50, currentKg: 52, goalKg: 55 })).toEqual({ fraction: 0.4, remainingKg: 3 });
    expect(weightGoalProgress({ startKg: 50, currentKg: 56, goalKg: 55 })).toEqual({ fraction: 1, remainingKg: 0 });
  });

  test('no goal gives null; start equal to goal does not divide by zero', () => {
    expect(weightGoalProgress({ startKg: 70, currentKg: 70, goalKg: null })).toBeNull();
    expect(weightGoalProgress({ startKg: 70, currentKg: 70, goalKg: 70 })).toEqual({ fraction: 1, remainingKg: 0 });
    expect(weightGoalProgress({ startKg: 70, currentKg: 71, goalKg: 70 })).toEqual({ fraction: 0, remainingKg: 1 });
  });
});

describe('relativeDayLabel', () => {
  test('names today and yesterday', () => {
    expect(relativeDayLabel('2026-11-11', '2026-11-11')).toBe('Today');
    expect(relativeDayLabel('2026-11-10', '2026-11-11')).toBe('Yesterday');
    expect(relativeDayLabel('2026-11-09', '2026-11-11')).toMatch(/9/);
  });
});

describe('weekdayLetter and moodSummary', () => {
  const { weekdayLetter, moodSummary } = require('../src/features/wellness/wellnessStats');

  test('weekdayLetter follows the calendar', () => {
    expect(weekdayLetter('2026-11-08')).toBe('S'); // Sunday
    expect(weekdayLetter('2026-11-09')).toBe('M');
    expect(weekdayLetter('2026-11-11')).toBe('W');
  });

  test('moodSummary counts logged days and names the most frequent mood', () => {
    const series = [
      { date: 'a', value: 3 },
      { date: 'b', value: null },
      { date: 'c', value: 3 },
      { date: 'd', value: 5 },
    ];
    expect(moodSummary(series)).toEqual({ logged: 3, total: 4, topLabel: 'Okay' });
  });

  test('moodSummary with nothing logged has no top mood, and ties are deterministic', () => {
    expect(moodSummary([{ date: 'a', value: null }])).toEqual({ logged: 0, total: 1, topLabel: null });
    expect(moodSummary([{ date: 'a', value: 2 }, { date: 'b', value: 4 }]).topLabel).toBe('Good');
    expect(moodSummary([])).toEqual({ logged: 0, total: 0, topLabel: null });
  });
});
