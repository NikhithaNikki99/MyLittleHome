import {
  Apple,
  BookOpen,
  Bike,
  Brain,
  Coffee,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Leaf,
  Moon,
  Music,
  Pencil,
  Pill,
  Sparkles,
  Sprout,
  Sun,
} from 'lucide-react-native';

// Keys match HABIT_ICON_KEYS in habitOptions.js.
const ICONS = {
  sprout: Sprout,
  droplets: Droplets,
  'book-open': BookOpen,
  dumbbell: Dumbbell,
  moon: Moon,
  sun: Sun,
  heart: Heart,
  apple: Apple,
  footprints: Footprints,
  brain: Brain,
  pencil: Pencil,
  music: Music,
  coffee: Coffee,
  leaf: Leaf,
  bike: Bike,
  pill: Pill,
  sparkles: Sparkles,
  flame: Flame,
};

export function HabitIcon({ name, color, size = 22 }) {
  const Icon = ICONS[name] ?? Sprout;
  return <Icon color={color} size={size} />;
}
