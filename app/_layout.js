import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseGate } from '../src/components/common/DatabaseGate';
import { AppLockGate } from '../src/features/settings/AppLockGate';
import { FONT_MAP } from '../src/theme/fonts';
import { ThemeProvider } from '../src/theme/ThemeProvider';

export default function RootLayout() {
  // Fonts are bundled, so this resolves locally. On failure we still render with system fonts.
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DatabaseGate>
            <AppLockGate>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }} />
            </AppLockGate>
          </DatabaseGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
