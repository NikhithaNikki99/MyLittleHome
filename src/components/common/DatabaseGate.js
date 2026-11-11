import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { loadSettingsIntoStore } from '../../features/settings/settingsService';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';

// Opens the database, runs migrations, and hydrates cached settings before rendering children.
export function DatabaseGate({ children }) {
  const theme = useTheme();
  const [state, setState] = useState({ status: 'loading', error: null });

  const init = useCallback(async () => {
    setState({ status: 'loading', error: null });
    try {
      await loadSettingsIntoStore();
      setState({ status: 'ready', error: null });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  if (state.status === 'ready') return children;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
        backgroundColor: theme.colors.background,
      }}
    >
      {state.status === 'loading' ? (
        <>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <AppText muted>Opening your little world…</AppText>
        </>
      ) : (
        <>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            We couldn't open your data
          </AppText>
          <AppText muted style={{ textAlign: 'center' }}>
            Your entries have not been changed. {state.error?.message ?? ''}
          </AppText>
          <Button title="Try again" onPress={init} />
        </>
      )}
    </View>
  );
}
