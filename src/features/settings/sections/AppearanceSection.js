import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Card } from '../../../components/common/Card';
import { FormError } from '../../../components/common/FormError';
import { palettes, THEME_IDS } from '../../../theme/palettes';
import { useTheme } from '../../../theme/ThemeProvider';
import { changeTheme } from '../settingsService';

// Each option previews its own palette (background, surface and accents), not the active theme's.
export function AppearanceSection() {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const [error, setError] = useState(null);

  const onPick = async (themeId) => {
    setError(null);
    try {
      await changeTheme(themeId);
    } catch {
      setError("Couldn't save your theme. Please try again.");
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="heading" accessibilityRole="header">
        Appearance
      </AppText>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        {THEME_IDS.map((id) => {
          const palette = palettes[id];
          const selected = id === theme.id;
          const p = palette.colors;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={`${palette.name} theme`}
              onPress={() => onPick(id)}
              style={{
                minHeight: theme.touchTarget + 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radii.md,
                borderWidth: 2,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primarySoft : colors.surface,
              }}
            >
              <View
                accessible={false}
                style={{
                  width: 76,
                  height: 44,
                  borderRadius: radii.sm,
                  padding: 6,
                  backgroundColor: p.background,
                  borderWidth: 1,
                  borderColor: p.border,
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ height: 12, borderRadius: 6, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border }} />
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[p.primary, p.accentLavender, p.accentButter, p.accentSage].map((c) => (
                    <View key={c} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c }} />
                  ))}
                </View>
              </View>
              <AppText variant="label" style={{ flex: 1 }}>
                {palette.name}
              </AppText>
              {selected ? (
                <AppText variant="caption" color={colors.primary}>
                  In use
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <FormError message={error} />
    </Card>
  );
}
