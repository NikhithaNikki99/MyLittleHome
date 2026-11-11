import { DEFAULT_THEME_ID, isValidThemeId, palettes, THEME_IDS } from '../src/theme/palettes';

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('palettes', () => {
  test('ships the four planned themes and a valid default', () => {
    expect(THEME_IDS).toEqual(['pinkDiary', 'lavenderDreams', 'matchaJournal', 'creamyTeddy']);
    expect(isValidThemeId(DEFAULT_THEME_ID)).toBe(true);
    expect(isValidThemeId('nope')).toBe(false);
    expect(isValidThemeId('toString')).toBe(false);
  });

  test('every palette defines the same colour keys', () => {
    const keys = Object.keys(palettes.pinkDiary.colors).sort();
    for (const id of THEME_IDS) {
      expect(Object.keys(palettes[id].colors).sort()).toEqual(keys);
    }
  });

  describe.each(THEME_IDS)('%s meets WCAG AA (4.5:1) for text-bearing colours', (id) => {
    const c = palettes[id].colors;
    const pairs = [
      ['text on backgroundTop', c.text, c.backgroundTop],
      ['text on backgroundBottom', c.text, c.backgroundBottom],
      ['textMuted on backgroundTop', c.textMuted, c.backgroundTop],
      ['textMuted on backgroundBottom', c.textMuted, c.backgroundBottom],
      ['primary on backgroundBottom', c.primary, c.backgroundBottom],
      ['secondary on backgroundBottom', c.secondary, c.backgroundBottom],
      ['success on backgroundBottom', c.success, c.backgroundBottom],
      ['text on background', c.text, c.background],
      ['text on surface', c.text, c.surface],
      ['textMuted on background', c.textMuted, c.background],
      ['textMuted on surface', c.textMuted, c.surface],
      ['textMuted on surfaceMuted', c.textMuted, c.surfaceMuted],
      ['text on primarySoft', c.text, c.primarySoft],
      ['onPrimary on primary', c.onPrimary, c.primary],
      ['primary on surface', c.primary, c.surface],
      ['primary on background', c.primary, c.background],
      ['secondary on surface', c.secondary, c.surface],
      ['secondary on background', c.secondary, c.background],
      ['success on surface', c.success, c.surface],
      ['info on surface', c.info, c.surface],
      ['danger on surface', c.danger, c.surface],
    ];

    test.each(pairs)('%s', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
