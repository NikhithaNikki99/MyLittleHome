import { createContext, useContext, useMemo } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { DEFAULT_THEME_ID, palettes } from './palettes';
import { makeShadow, radii, spacing, TOUCH_TARGET, typography } from './tokens';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const themeId = useSettingsStore((s) => s.themeId);

  const theme = useMemo(() => {
    const palette = palettes[themeId] ?? palettes[DEFAULT_THEME_ID];
    return {
      id: palette.id,
      name: palette.name,
      colors: palette.colors,
      spacing,
      radii,
      typography,
      touchTarget: TOUCH_TARGET,
      shadow: makeShadow(palette.colors.text),
    };
  }, [themeId]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (theme == null) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return theme;
}
