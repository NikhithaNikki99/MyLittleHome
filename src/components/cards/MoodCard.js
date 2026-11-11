import * as Haptics from 'expo-haptics';
import { Frown, Laugh, Meh, Smile, SmilePlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { MOODS } from '../../constants/moods';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../common/AppText';

const ICONS = { 1: Frown, 2: Meh, 3: Smile, 4: SmilePlus, 5: Laugh };

// Title sits on the page background; tiles are one compact row, as in the design.
export function MoodCard({ mood, onPick }) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const picked = MOODS.find((m) => m.value === mood);

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="heading">{picked ? `Feeling ${picked.label.toLowerCase()} today` : 'How are you feeling today?'}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {MOODS.map((m) => {
          const Icon = ICONS[m.value];
          const selected = m.value === mood;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${m.label} mood`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPick(m.value);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 62,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderRadius: radii.md,
                borderWidth: 2,
                borderColor: selected ? colors.primary : 'transparent',
                backgroundColor: colors[m.tone],
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Icon color={colors.text} size={22} />
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
