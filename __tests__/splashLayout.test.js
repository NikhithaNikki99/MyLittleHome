import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { EDGE_COLORS, PICTURE, fitSplash } from '../src/features/splash/splashLayout';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const SCREENS = [
  [411.43, 914.29], // Pixel_7 emulator in dp (1080 x 2400 px)
  [360, 800],
  [320, 480],
  [800, 1280],
  [1280, 800],
  [100, 100],
];

describe('where the splash picture goes', () => {
  test('the picture is never stretched, whatever the screen', () => {
    for (const [w, h] of SCREENS) {
      const l = fitSplash(w, h);
      expect(near(l.width / l.height, PICTURE.width / PICTURE.height, 1e-9)).toBe(true);
    }
  });

  test('the whole picture is always on screen, so nothing is cropped', () => {
    for (const [w, h] of SCREENS) {
      const l = fitSplash(w, h);
      expect(l.left).toBeGreaterThanOrEqual(-1e-9);
      expect(l.top).toBeGreaterThanOrEqual(-1e-9);
      expect(l.left + l.width).toBeLessThanOrEqual(w + 1e-9);
      expect(l.top + l.height).toBeLessThanOrEqual(h + 1e-9);
    }
  });

  test('the picture is centred', () => {
    for (const [w, h] of SCREENS) {
      const l = fitSplash(w, h);
      expect(near(l.left * 2 + l.width, w)).toBe(true);
      expect(near(l.top * 2 + l.height, h)).toBe(true);
    }
  });

  test('the picture is as large as it can be, touching the screen on at least one axis', () => {
    for (const [w, h] of SCREENS) {
      const l = fitSplash(w, h);
      expect(near(l.width, w) || near(l.height, h)).toBe(true);
    }
  });

  test('on the phone it was drawn for, the picture fills the screen with under 1 dp left over', () => {
    const l = fitSplash(411.43, 914.29);
    expect(l.top).toBeLessThan(1);
    expect(l.left).toBeLessThan(1);
    expect(l.width).toBeGreaterThan(410);
    expect(l.height).toBeGreaterThan(913);
  });

  test('a taller screen leaves bands above and below, a wider one at the sides', () => {
    const tall = fitSplash(300, 900);
    expect(tall.left).toBeCloseTo(0, 6);
    expect(tall.top).toBeGreaterThan(0);
    const wide = fitSplash(1280, 800);
    expect(wide.top).toBeCloseTo(0, 6);
    expect(wide.left).toBeGreaterThan(0);
  });

  test('a screen with exactly the picture shape has no bands', () => {
    const l = fitSplash(841, 1870);
    expect(near(l.left, 0)).toBe(true);
    expect(near(l.top, 0)).toBe(true);
    expect(near(l.width, 841)).toBe(true);
  });

  test('a degenerate screen does not produce NaN', () => {
    for (const [w, h] of [[0, 0], [0, 500], [500, 0]]) {
      const l = fitSplash(w, h);
      for (const v of [l.left, l.top, l.width, l.height]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('the picture file and the numbers describing it', () => {
  const file = PNG.sync.read(fs.readFileSync(path.join(__dirname, '..', 'assets', 'splash-screen.png')));
  const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const rowAverage = (y) => {
    const sum = [0, 0, 0];
    for (let x = 0; x < file.width; x++) {
      const i = (y * file.width + x) * 4;
      for (let k = 0; k < 3; k++) sum[k] += file.data[i + k];
    }
    return sum.map((v) => v / file.width);
  };

  test('the recorded picture size is the size of the file', () => {
    expect(file.width).toBe(PICTURE.width);
    expect(file.height).toBe(PICTURE.height);
  });

  test('the edge colours are the real colours of the first and last rows', () => {
    const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const parse = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    expect(close(parse(EDGE_COLORS.top), rowAverage(0))).toBeLessThan(6);
    expect(close(parse(EDGE_COLORS.bottom), rowAverage(file.height - 1))).toBeLessThan(6);
    expect(hex(rowAverage(0))).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('the file has no edge strip that differs from the picture next to it', () => {
    const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (let y = 0; y < 5; y++) expect(close(rowAverage(y), rowAverage(10))).toBeLessThan(12);
    for (let y = file.height - 5; y < file.height; y++) expect(close(rowAverage(y), rowAverage(file.height - 11))).toBeLessThan(12);
  });
});
