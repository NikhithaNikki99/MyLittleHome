import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';

// Placeholder for a screen whose feature is not built yet. Replaced as each feature lands.
export function ComingSoon({ title, back = false }) {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScreenHeader title={title} back={back} />
      <EmptyState
        icon={<Sparkles color={colors.primary} size={32} />}
        title="Coming soon"
        message="This part of your little world is still being built."
      />
    </Screen>
  );
}
