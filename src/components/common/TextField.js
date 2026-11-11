import { TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export function TextField({ label, error, style, ...rest }) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          theme.typography.body,
          {
            minHeight: theme.touchTarget,
            paddingHorizontal: spacing.lg,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
