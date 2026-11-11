import { View } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { AppText } from '../../../components/common/AppText';
import { MOOD_ICONS, moodOf } from './moodIcons';

const TAG_TONES = ['accentPink', 'accentLavender', 'accentSage', 'accentButter', 'accentBlue'];

function toneFor(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return TAG_TONES[sum % TAG_TONES.length];
}

// Read-only label; tags you can tap use the shared Chip instead.
export function TagPill({ name }) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: colors[toneFor(name)],
      }}
    >
      <AppText variant="caption" style={{ fontWeight: '600' }}>
        {name}
      </AppText>
    </View>
  );
}

export function MoodPill({ mood }) {
  const { colors, spacing, radii } = useTheme();
  const info = moodOf(mood);
  if (!info) return null;
  const Icon = MOOD_ICONS[info.value];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: colors[info.tone],
      }}
    >
      <Icon color={colors.text} size={16} />
      <AppText variant="caption" style={{ fontWeight: '600' }}>
        {info.label}
      </AppText>
    </View>
  );
}
