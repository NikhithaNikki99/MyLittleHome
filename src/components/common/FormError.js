import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export function FormError({ message }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <AppText color={colors.danger} accessibilityLiveRegion="polite">
      {message}
    </AppText>
  );
}
