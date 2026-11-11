import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { useTheme } from '../../../theme/ThemeProvider';

// A tappable list row: tinted icon tile, title, optional detail, chevron. Used by More and Settings.
export function SettingsRow({ icon, tone = 'accentPink', title, detail, onPress, accessibilityLabel, trailing }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detail ? `${title}, ${detail}` : title)}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: touchTarget + 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors[tone],
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{title}</AppText>
        {detail ? (
          <AppText variant="caption" muted>
            {detail}
          </AppText>
        ) : null}
      </View>
      {trailing ?? <ChevronRight color={colors.textMuted} size={20} />}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}
