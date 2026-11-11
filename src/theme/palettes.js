// Text-bearing colours (text, textMuted, primary, secondary, success, info, danger)
// are verified to reach WCAG AA (4.5:1) on background/surface by __tests__/theme.test.js.
// Accent* and *Soft colours are decorative fills; text on them uses `text`.

const accents = {
  accentPink: '#F8D7DF',
  accentLavender: '#E3D9F5',
  accentButter: '#FBEFB8',
  accentSage: '#D3E5D0',
  accentBlue: '#D6E4F2',
};

export const palettes = {
  pinkDiary: {
    id: 'pinkDiary',
    name: 'Pink Diary',
    colors: {
      backgroundTop: '#FFF1F3',
      background: '#FDEEF1',
      backgroundBottom: '#FCE9ED',
      surface: '#FFFAFA',
      surfaceMuted: '#FBE9ED',
      border: '#F0D5DB',
      text: '#3D2B30',
      textMuted: '#6E5A60',
      primary: '#A8466A',
      onPrimary: '#FFFFFF',
      primarySoft: '#F6D3DC',
      secondary: '#6F58A0',
      success: '#4A7052',
      info: '#52739A',
      danger: '#B3433F',
      ...accents,
    },
  },
  lavenderDreams: {
    id: 'lavenderDreams',
    name: 'Lavender Dreams',
    colors: {
      backgroundTop: '#FAF7FF',
      background: '#FAF7FF',
      backgroundBottom: '#FAF7FF',
      surface: '#FFFFFF',
      surfaceMuted: '#F3EEFB',
      border: '#E4DCF0',
      text: '#2F2A40',
      textMuted: '#5F5877',
      primary: '#7660A8',
      onPrimary: '#FFFFFF',
      primarySoft: '#E6DDF6',
      secondary: '#A8506D',
      success: '#52795A',
      info: '#52739A',
      danger: '#B3433F',
      ...accents,
    },
  },
  matchaJournal: {
    id: 'matchaJournal',
    name: 'Matcha Journal',
    colors: {
      backgroundTop: '#F7F8EE',
      background: '#F7F8EE',
      backgroundBottom: '#F7F8EE',
      surface: '#FFFFFF',
      surfaceMuted: '#EDF1E2',
      border: '#DCE3CB',
      text: '#2B3328',
      textMuted: '#566052',
      primary: '#587A55',
      onPrimary: '#FFFFFF',
      primarySoft: '#DDE8D2',
      secondary: '#7761A2',
      success: '#4E7A52',
      info: '#52739A',
      danger: '#B3433F',
      ...accents,
    },
  },
  creamyTeddy: {
    id: 'creamyTeddy',
    name: 'Creamy Teddy',
    colors: {
      backgroundTop: '#FBF3E8',
      background: '#FBF3E8',
      backgroundBottom: '#FBF3E8',
      surface: '#FFFDF8',
      surfaceMuted: '#F4E8D6',
      border: '#E6D5BD',
      text: '#3F3027',
      textMuted: '#6B584A',
      primary: '#94623F',
      onPrimary: '#FFFFFF',
      primarySoft: '#EBD5BD',
      secondary: '#A8506D',
      success: '#52795A',
      info: '#52739A',
      danger: '#B3433F',
      ...accents,
    },
  },
};

export const DEFAULT_THEME_ID = 'pinkDiary';
export const THEME_IDS = Object.keys(palettes);

export function isValidThemeId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(palettes, id);
}
