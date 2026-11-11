import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export function Card({ tone = 'surface', style, ...rest }) {
  const theme = useTheme();
  const backgroundColor = tone === 'surface' ? theme.colors.surface : theme.colors[tone];
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
        theme.shadow,
        style,
      ]}
    />
  );
}
