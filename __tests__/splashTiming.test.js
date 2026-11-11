import { FADE_MS, MAX_VISIBLE_MS, MIN_VISIBLE_MS, remainingMs, shouldHide } from '../src/features/splash/splashTiming';

const at = (shownAt, elapsed, appReady) => ({ shownAt, now: shownAt + elapsed, appReady });

describe('how long the splash picture stays up', () => {
  test('a fast start still shows the picture for the minimum time', () => {
    expect(shouldHide(at(1000, 0, true))).toBe(false);
    expect(shouldHide(at(1000, MIN_VISIBLE_MS - 1, true))).toBe(false);
    expect(shouldHide(at(1000, MIN_VISIBLE_MS, true))).toBe(true);
  });

  test('a slow start keeps it up until the app is ready', () => {
    expect(shouldHide(at(0, MIN_VISIBLE_MS + 1500, false))).toBe(false);
    expect(shouldHide(at(0, MIN_VISIBLE_MS + 1500, true))).toBe(true);
  });

  test('it can never hide the app forever, even if the app never becomes ready', () => {
    expect(shouldHide(at(0, MAX_VISIBLE_MS - 1, false))).toBe(false);
    expect(shouldHide(at(0, MAX_VISIBLE_MS, false))).toBe(true);
    expect(shouldHide(at(0, MAX_VISIBLE_MS * 3, false))).toBe(true);
  });

  test('remaining time counts down to the minimum when the app is ready', () => {
    expect(remainingMs(at(0, 0, true))).toBe(MIN_VISIBLE_MS);
    expect(remainingMs(at(0, 500, true))).toBe(MIN_VISIBLE_MS - 500);
    expect(remainingMs(at(0, MIN_VISIBLE_MS, true))).toBe(0);
    expect(remainingMs(at(0, MIN_VISIBLE_MS + 400, true))).toBe(0);
  });

  test('remaining time counts down to the maximum while the app is not ready', () => {
    expect(remainingMs(at(0, 2000, false))).toBe(MAX_VISIBLE_MS - 2000);
    expect(remainingMs(at(0, MAX_VISIBLE_MS, false))).toBe(0);
    expect(remainingMs(at(0, MAX_VISIBLE_MS + 5, false))).toBe(0);
  });

  test('timings are sensible: visible long enough to read, short enough to be quick', () => {
    expect(MIN_VISIBLE_MS).toBeGreaterThanOrEqual(800);
    expect(MIN_VISIBLE_MS).toBeLessThanOrEqual(2000);
    expect(MAX_VISIBLE_MS).toBeGreaterThan(MIN_VISIBLE_MS * 2);
    expect(FADE_MS).toBeGreaterThan(0);
    expect(FADE_MS).toBeLessThan(MIN_VISIBLE_MS);
  });

  test('hide and remaining agree: when nothing remains and the app is ready, it hides', () => {
    for (const elapsed of [0, 300, 1199, 1200, 1201, 5000, 8000, 9000]) {
      for (const appReady of [true, false]) {
        const input = at(0, elapsed, appReady);
        if (remainingMs(input) === 0) expect(shouldHide(input)).toBe(true);
        else expect(shouldHide(input)).toBe(false);
      }
    }
  });
});
