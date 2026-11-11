import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export function Button({ title, onPress, variant = 'primary', disabled = false, style, accessibilityLabel }) {
  const theme = useTheme();
  const { colors } = theme;

  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    soft: { bg: colors.primarySoft, fg: colors.text, border: colors.primarySoft },
    outline: { bg: 'transparent', fg: colors.primary, border: colors.primary },
  }[variant];

  const handlePress = (event) => {
    Haptics.selectionAsync().catch(() => {});
    onPress?.(event);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        {
          minHeight: theme.touchTarget,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.bg,
          borderWidth: 1.5,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <AppText variant="label" color={palette.fg}>
        {title}
      </AppText>
    </Pressable>
  );
}
