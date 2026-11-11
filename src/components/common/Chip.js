import { Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export function Chip({ label, selected = false, onPress, accessibilityLabel }) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: theme.touchTarget,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
      }}
    >
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}
