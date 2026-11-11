import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';
import { Card } from './Card';

export function EmptyState({ icon, title, message }) {
  const theme = useTheme();
  return (
    <Card tone="surfaceMuted" style={{ alignItems: 'center', gap: theme.spacing.sm }}>
      {icon ? <View accessible={false}>{icon}</View> : null}
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
    </Card>
  );
}
