import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

// `tabs`: [{ key, label }]. Pill-style tabs as in the Expenses / Wellness / Habits / Planner headers.
export function SegmentedTabs({ tabs, value, onChange }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {tabs.map((t) => {
        const selected = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(t.key)}
            style={{
              flex: 1,
              minHeight: touchTarget - 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.primarySoft : 'transparent',
            }}
          >
            <AppText variant="label" color={selected ? colors.primary : colors.textMuted}>
              {t.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
