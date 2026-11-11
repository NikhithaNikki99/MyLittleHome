import { Frown, Laugh, Meh, Smile, SmilePlus } from 'lucide-react-native';
import { MOODS } from '../../../constants/moods';

export const MOOD_ICONS = { 1: Frown, 2: Meh, 3: Smile, 4: SmilePlus, 5: Laugh };

export function moodOf(value) {
  return MOODS.find((m) => m.value === value) ?? null;
}
