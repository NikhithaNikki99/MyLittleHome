// Which scene the Home header shows for a given hour, and where the sun or moon is in it. Pure, so it is covered by
// Jest. The boundaries follow greetingFor() in utils/dates.js (5, 12, 17, 21), so the picture never disagrees with
// the greeting above it ("Good evening" is never drawn over a night sky).
//
//   night      21:00 - 05:00  moon and stars          (greeting: "Good night" / "Still up?")
//   morning    05:00 - 12:00  sunrise to midday       (greeting: "Good morning")
//   afternoon  12:00 - 17:00  bright day              (greeting: "Good afternoon")
//   evening    17:00 - 21:00  sunset to dusk          (greeting: "Good evening")

export const PERIODS = ['night', 'morning', 'afternoon', 'evening'];

export function periodForHour(hour) {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

// Colours per period. Sky is top, middle, bottom; hills are the far and near hill; the fade colour is not here
// because it comes from the app theme.
export const SCENES = {
  morning: {
    sky: ['#BFE3F5', '#FBE3D6', '#FDEFD8'],
    sun: { color: '#FFE3A3', opacity: 0.95, radius: 28 },
    hillFar: { color: '#B5D3C0', opacity: 0.75 },
    hillNear: { color: '#8FBF9D', opacity: 0.85 },
    trees: { color: '#6FA283', opacity: 0.85 },
    stars: false,
  },
  afternoon: {
    sky: ['#8FD0F2', '#B9E2F7', '#E3F3FA'],
    sun: { color: '#FFF1B8', opacity: 0.95, radius: 26 },
    hillFar: { color: '#A9D4B0', opacity: 0.75 },
    hillNear: { color: '#7DBB8A', opacity: 0.85 },
    trees: { color: '#5E9C73', opacity: 0.85 },
    stars: false,
  },
  evening: {
    sky: ['#F4B9C6', '#F9D5C8', '#FCE6D2'],
    sun: { color: '#FBE3B5', opacity: 0.9, radius: 30 },
    hillFar: { color: '#E9A9B6', opacity: 0.7 },
    hillNear: { color: '#D58BA0', opacity: 0.8 },
    trees: { color: '#8FAF8C', opacity: 0.85 },
    stars: false,
  },
  night: {
    // The greeting and date sit over the bottom of the header, so the horizon is a pale dusk glow on purpose: a darker
    // sky bottom or darker hills pushed the muted date text below the 4.5:1 contrast the rest of the app keeps (the
    // first draft, #8A7DB0 sky and #58588F / #40407A hills, gave 3.9:1). These are the darkest values that pass in all
    // four themes. __tests__/timeOfDay.test.js checks the full stack (sky, both hills, then the fade).
    sky: ['#2A3563', '#4A4A86', '#CFC6E4'],
    sun: { color: '#F6F1D6', opacity: 0.95, radius: 20 }, // the moon
    hillFar: { color: '#A5A5CC', opacity: 0.8 },
    hillNear: { color: '#9696C2', opacity: 0.9 },
    trees: { color: '#7878B0', opacity: 0.9 },
    stars: true,
  },
};

// The colour at the very top of the scene for a given time, used to paint the strip behind the status bar so the sky
// appears to carry on up to the edge of the screen.
export function sceneTopColor(date = new Date()) {
  return SCENES[periodForHour(date.getHours())].sky[0];
}

// Position of the sun or moon in the 400 x 180 drawing. The sun is up from 05:00 to 21:00 and the moon from 21:00 to
// 05:00. Each crosses the sky from left to right along one arch: low at the horizon at either end, highest in the
// middle. When the sun sets at the right edge the moon rises at the left edge, so the change reads as a hand-off.
export const SKY_BOUNDS = { xStart: 60, xEnd: 340, yHorizon: 112, yPeak: 34 };

// 0 at the start of the body's time in the sky, 1 at the end.
export function skyProgress(hour, minute = 0) {
  const t = hour + minute / 60;
  if (t >= 5 && t < 21) return (t - 5) / 16;
  return (t >= 21 ? t - 21 : t + 3) / 8;
}

export function bodyPosition(hour, minute = 0) {
  const progress = Math.min(1, Math.max(0, skyProgress(hour, minute)));
  const { xStart, xEnd, yHorizon, yPeak } = SKY_BOUNDS;
  const x = xStart + (xEnd - xStart) * progress;
  const y = yHorizon - (yHorizon - yPeak) * Math.sin(progress * Math.PI);
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

// A fixed pattern of stars (x, y, radius), so they do not move or flicker between renders.
export const STARS = [
  [34, 22, 1.4], [78, 44, 1], [120, 18, 1.2], [158, 52, 0.9], [196, 28, 1.3], [232, 14, 1], [296, 40, 1.2], [336, 20, 1.4],
  [372, 54, 1], [58, 70, 0.9], [210, 68, 0.8], [350, 78, 0.9],
];

// How many milliseconds until the next scene change, so the header can refresh itself while the app stays open.
export function msUntilNextPeriod(now = new Date()) {
  const next = new Date(now);
  const hour = now.getHours();
  const boundary = [5, 12, 17, 21].find((b) => b > hour);
  if (boundary === undefined) {
    next.setDate(next.getDate() + 1);
    next.setHours(5, 0, 0, 0);
  } else {
    next.setHours(boundary, 0, 0, 0);
  }
  return Math.max(1000, next.getTime() - now.getTime());
}

// Whether the status bar icons should be light or dark on a strip of the given colour: dark icons on a light strip,
// light icons on a dark one. Uses the WCAG relative luminance, and picks whichever gives the clearer contrast.
export function statusBarStyleFor(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const withDark = (luminance + 0.05) / (0.0 + 0.05); // against black icons
  const withLight = 1.05 / (luminance + 0.05); // against white icons
  return withDark >= withLight ? 'dark' : 'light';
}
