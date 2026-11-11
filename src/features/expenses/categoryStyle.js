import {
  Clapperboard,
  Ellipsis,
  GraduationCap,
  HeartPulse,
  Plane,
  Receipt,
  ShoppingBag,
  Sparkles,
  Tag,
  Utensils,
} from 'lucide-react-native';

// UI-only mapping from a category to its icon and theme colours. The icon comes from the category's stored
// `icon` name; colours are deterministic per category id (known ids first, anything else hashed) so a
// category looks the same in every screen and every month.

const ICONS = {
  utensils: Utensils,
  plane: Plane,
  'shopping-bag': ShoppingBag,
  receipt: Receipt,
  'heart-pulse': HeartPulse,
  clapperboard: Clapperboard,
  'graduation-cap': GraduationCap,
  sparkles: Sparkles,
  ellipsis: Ellipsis,
};

const KNOWN_IDS = [
  'cat-food',
  'cat-travel',
  'cat-shopping',
  'cat-bills',
  'cat-health',
  'cat-entertainment',
  'cat-education',
  'cat-personal-care',
  'cat-other',
];

// Pale fills for tiles and badges (text on them uses the normal text colour).
const TONES = ['accentPink', 'accentBlue', 'accentLavender', 'accentButter', 'accentSage'];

// Distinct chart colours, one per known category. Every row in the breakdown also shows a name and a
// percentage, so colour is never the only way to tell categories apart.
const CHART_COLORS = [
  'primary',
  'info',
  'secondary',
  'success',
  'accentPink',
  'accentBlue',
  'accentSage',
  'accentLavender',
  'accentButter',
];

function styleIndex(categoryId) {
  const known = KNOWN_IDS.indexOf(categoryId);
  if (known !== -1) return known;
  let hash = 0;
  for (const ch of String(categoryId)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return hash;
}

// Returns { Icon, tone, chart }; `tone` and `chart` are keys into theme.colors.
export function getCategoryStyle(categoryId, iconName) {
  const index = styleIndex(categoryId);
  return {
    Icon: ICONS[iconName] ?? Tag,
    tone: TONES[index % TONES.length],
    chart: CHART_COLORS[index % CHART_COLORS.length],
  };
}
