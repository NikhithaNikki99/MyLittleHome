// How long the in-app splash stays up. Pure, so the rule is covered by Jest.
// The picture is shown until the app is ready (fonts loaded, database open) AND it has been on screen for at
// least MIN_VISIBLE_MS, so a fast start does not flash it for a few frames. MAX_VISIBLE_MS stops a slow or
// failing start from hiding the app behind it forever.
export const MIN_VISIBLE_MS = 1200;
export const MAX_VISIBLE_MS = 8000;
export const FADE_MS = 350;

// Milliseconds still to wait before the splash may go away. 0 means it can go now.
export function remainingMs({ shownAt, now, appReady }) {
  const visible = now - shownAt;
  if (visible >= MAX_VISIBLE_MS) return 0;
  if (!appReady) return MAX_VISIBLE_MS - visible;
  return Math.max(0, MIN_VISIBLE_MS - visible);
}

export function shouldHide({ shownAt, now, appReady }) {
  const visible = now - shownAt;
  if (visible >= MAX_VISIBLE_MS) return true;
  return appReady && visible >= MIN_VISIBLE_MS;
}
