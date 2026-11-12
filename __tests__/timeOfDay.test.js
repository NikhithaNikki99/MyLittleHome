import {
  PERIODS,
  SCENES,
  SKY_BOUNDS,
  STARS,
  bodyPosition,
  msUntilNextPeriod,
  periodForHour,
  sceneTopColor,
  skyProgress,
  statusBarStyleFor,
} from '../src/components/illustrations/timeOfDay';
import { greetingFor } from '../src/utils/dates';
import { palettes } from '../src/theme/palettes';

const at = (h, m = 0) => new Date(2026, 10, 12, h, m, 0, 0);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const blend = (top, bottom, alpha) => {
  const t = rgb(top);
  const b = rgb(bottom);
  return `#${t.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
};

describe('which scene is shown at each hour', () => {
  test('every hour belongs to exactly one known period', () => {
    for (let h = 0; h < 24; h++) expect(PERIODS).toContain(periodForHour(h));
  });

  test('the boundaries are 05:00, 12:00, 17:00 and 21:00', () => {
    expect([4, 5, 11, 12, 16, 17, 20, 21].map(periodForHour)).toEqual([
      'night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night',
    ]);
  });

  test('the scene always agrees with the greeting above it', () => {
    const nightGreetings = ['Good night', 'Still up?'];
    for (let h = 0; h < 24; h++) {
      const greeting = greetingFor(at(h));
      const period = periodForHour(h);
      if (period === 'night') expect(nightGreetings).toContain(greeting);
      if (period === 'morning') expect(greeting).toBe('Good morning');
      if (period === 'afternoon') expect(greeting).toBe('Good afternoon');
      if (period === 'evening') expect(greeting).toBe('Good evening');
    }
  });

  test('every period has a complete scene, and only the night has stars', () => {
    for (const p of PERIODS) {
      const s = SCENES[p];
      expect(s.sky).toHaveLength(3);
      for (const c of [...s.sky, s.sun.color, s.hillFar.color, s.hillNear.color, s.trees.color]) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(s.stars).toBe(p === 'night');
    }
  });

  test('a fixed set of stars sits inside the drawing', () => {
    expect(STARS.length).toBeGreaterThan(5);
    for (const [x, y, r] of STARS) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(400);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(90);
      expect(r).toBeGreaterThan(0);
    }
  });
});

describe('where the sun and moon are', () => {
  test('the sun rises at 05:00, peaks at 13:00 and sets at 21:00', () => {
    const rise = bodyPosition(5);
    const noon = bodyPosition(13);
    const set = bodyPosition(20, 59);
    expect(rise.x).toBeCloseTo(SKY_BOUNDS.xStart, 0);
    expect(rise.y).toBeCloseTo(SKY_BOUNDS.yHorizon, 0);
    expect(noon.y).toBeCloseTo(SKY_BOUNDS.yPeak, 0);
    expect(noon.x).toBeCloseTo((SKY_BOUNDS.xStart + SKY_BOUNDS.xEnd) / 2, 0);
    expect(set.x).toBeGreaterThan(SKY_BOUNDS.xEnd - 5);
    expect(set.y).toBeGreaterThan(SKY_BOUNDS.yHorizon - 5);
  });

  test('the moon crosses the night the same way, peaking at 01:00', () => {
    expect(bodyPosition(21).x).toBeCloseTo(SKY_BOUNDS.xStart, 0);
    expect(bodyPosition(1).y).toBeCloseTo(SKY_BOUNDS.yPeak, 0);
    expect(bodyPosition(4, 59).x).toBeGreaterThan(SKY_BOUNDS.xEnd - 5);
  });

  test('it only ever moves forward across the sky within one body, never jumps', () => {
    const jumpLimit = 30; // units in the 400-wide drawing between 30-minute steps; the moon is fastest near the horizon (about 23)
    for (const [from, to] of [[5 * 60, 21 * 60 - 30], [21 * 60, 24 * 60 - 30], [0, 5 * 60 - 30]]) {
      let prev = null;
      for (let m = from; m <= to; m += 30) {
        const p = bodyPosition(Math.floor(m / 60), m % 60);
        if (prev) {
          expect(p.x).toBeGreaterThanOrEqual(prev.x - 1e-9);
          expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan(jumpLimit);
        }
        prev = p;
      }
    }
  });

  test('the night runs through midnight without a break', () => {
    const before = bodyPosition(23, 30);
    const after = bodyPosition(0, 0);
    expect(after.x).toBeGreaterThan(before.x);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(25);
  });

  test('the body is always inside the drawing and above the hills', () => {
    for (let m = 0; m < 24 * 60; m += 15) {
      const p = bodyPosition(Math.floor(m / 60), m % 60);
      expect(p.x).toBeGreaterThanOrEqual(SKY_BOUNDS.xStart - 1);
      expect(p.x).toBeLessThanOrEqual(SKY_BOUNDS.xEnd + 1);
      expect(p.y).toBeGreaterThanOrEqual(SKY_BOUNDS.yPeak - 1);
      expect(p.y).toBeLessThanOrEqual(SKY_BOUNDS.yHorizon + 1);
    }
  });

  test('progress is 0 to 1 over the sun hours and over the moon hours', () => {
    expect(skyProgress(5)).toBe(0);
    expect(skyProgress(13)).toBeCloseTo(0.5, 6);
    expect(skyProgress(20, 59)).toBeGreaterThan(0.99);
    expect(skyProgress(21)).toBe(0);
    expect(skyProgress(1)).toBeCloseTo(0.5, 6);
    expect(skyProgress(4, 59)).toBeGreaterThan(0.99);
  });
});

describe('the strip behind the status bar', () => {
  test('it takes the top colour of the scene being shown', () => {
    expect(sceneTopColor(at(6))).toBe(SCENES.morning.sky[0]);
    expect(sceneTopColor(at(13))).toBe(SCENES.afternoon.sky[0]);
    expect(sceneTopColor(at(18))).toBe(SCENES.evening.sky[0]);
    expect(sceneTopColor(at(23))).toBe(SCENES.night.sky[0]);
    expect(sceneTopColor(at(3))).toBe(SCENES.night.sky[0]);
  });

  test('the icons are dark on a light strip and light on a dark one', () => {
    expect(statusBarStyleFor('#FFFFFF')).toBe('dark');
    expect(statusBarStyleFor('#000000')).toBe('light');
    expect(statusBarStyleFor('#2A3563')).toBe('light'); // the night sky
    expect(statusBarStyleFor('#BFE3F5')).toBe('dark'); // the morning sky
    expect(statusBarStyleFor('#8FD0F2')).toBe('dark'); // the afternoon sky
    expect(statusBarStyleFor('#F4B9C6')).toBe('dark'); // the evening sky
  });

  test('whichever icon colour is chosen, it reads clearly on the strip in every period', () => {
    for (const p of PERIODS) {
      const top = SCENES[p].sky[0];
      const icon = statusBarStyleFor(top) === 'dark' ? '#000000' : '#FFFFFF';
      expect(contrast(icon, top)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('when the scene changes', () => {
  test('the header knows how long until the next boundary', () => {
    expect(msUntilNextPeriod(at(4, 59))).toBe(60 * 1000);
    expect(msUntilNextPeriod(at(11, 30))).toBe(30 * 60 * 1000);
    expect(msUntilNextPeriod(at(16, 0))).toBe(60 * 60 * 1000);
    expect(msUntilNextPeriod(at(20, 0))).toBe(60 * 60 * 1000);
  });

  test('after 21:00 the next change is 05:00 the next morning', () => {
    expect(msUntilNextPeriod(at(21, 0))).toBe(8 * 60 * 60 * 1000);
    expect(msUntilNextPeriod(at(23, 30))).toBe(5.5 * 60 * 60 * 1000);
  });

  test('it never returns a delay of zero, which would make a timer spin', () => {
    for (let m = 0; m < 24 * 60; m++) expect(msUntilNextPeriod(at(Math.floor(m / 60), m % 60))).toBeGreaterThanOrEqual(1000);
  });

  test('stepping to the delay lands in a different period', () => {
    for (const h of [0, 4, 6, 11, 13, 16, 18, 20, 22]) {
      const now = at(h, 15);
      const later = new Date(now.getTime() + msUntilNextPeriod(now) + 1000);
      expect(periodForHour(later.getHours())).not.toBe(periodForHour(now.getHours()));
    }
  });
});

describe('the header text stays readable in every scene and every theme', () => {
  // What is drawn behind the greeting and the date, bottom to top: the sky gradient, the far hill, the near hill, then
  // a fade into the page colour that grows from nothing at y=100 to full strength at y=180 (see SunsetHeader.js). Each
  // line is tested only at the height where it really sits in the 180-high drawing, with the colour it really uses.
  // An earlier version of this test ignored the hills and passed while the real screen measured 3.8:1.
  const mix = (top, bottom, alpha) =>
    `#${rgb(top).map((v, i) => Math.round(v * alpha + rgb(bottom)[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
  const skyAt = (stops, y) => {
    const t = y / 180;
    return t < 0.55 ? mix(stops[1], stops[0], t / 0.55) : mix(stops[2], stops[1], (t - 0.55) / 0.45);
  };
  const fadeAt = (y) => Math.min(1, Math.max(0, (y - 100) / 80));
  const behind = (scene, pageTop, y) => {
    let c = skyAt(scene.sky, y);
    c = mix(scene.hillFar.color, c, scene.hillFar.opacity);
    c = mix(scene.hillNear.color, c, scene.hillNear.opacity);
    return mix(pageTop, c, fadeAt(y));
  };
  const LINES = [
    { name: 'greeting and name', from: 139, to: 152, colour: 'text' },
    { name: 'date', from: 160, to: 171, colour: 'textMuted' },
  ];

  for (const [themeId, theme] of Object.entries(palettes)) {
    for (const period of PERIODS) {
      test(`${themeId} / ${period}`, () => {
        for (const line of LINES) {
          for (let y = line.from; y <= line.to; y++) {
            const bg = behind(SCENES[period], theme.colors.backgroundTop, y);
            expect(contrast(theme.colors[line.colour], bg)).toBeGreaterThanOrEqual(4.5);
          }
        }
      });
    }
  }
});
