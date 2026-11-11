export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
};

// Serif italic used for screen titles and the greeting name. Family names must match the keys
// registered in src/theme/fonts.js; on Android the weight/style live in the family name itself.
export const FONT_DISPLAY = 'PlayfairDisplay_500Medium_Italic';
export const FONT_DISPLAY_BOLD = 'PlayfairDisplay_700Bold_Italic';

export const typography = {
  screenTitle: { fontFamily: FONT_DISPLAY, fontSize: 32, lineHeight: 42 },
  display: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
};

export const TOUCH_TARGET = 48;

export function makeShadow(color) {
  return {
    shadowColor: color,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };
}
