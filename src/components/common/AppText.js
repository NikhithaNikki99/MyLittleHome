import { Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export function AppText({ variant = 'body', muted = false, color, style, ...rest }) {
  const theme = useTheme();
  return (
    <Text
      {...rest}
      style={[
        theme.typography[variant],
        { color: color ?? (muted ? theme.colors.textMuted : theme.colors.text) },
        style,
      ]}
    />
  );
}
