import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseGate } from '../src/components/common/DatabaseGate';
import { AppLockGate } from '../src/features/settings/AppLockGate';
import { useAppLockStore } from '../src/features/settings/appLockStore';
import { SplashOverlay } from '../src/features/splash/SplashOverlay';
import { FONT_MAP } from '../src/theme/fonts';
import { ThemeProvider } from '../src/theme/ThemeProvider';

// The native splash stays up until the in-app splash picture has been drawn (see SplashOverlay), so the two
// hand over without a gap.
SplashScreen.preventAutoHideAsync().catch(() => {});

// If the picture never loads, the native splash must still go away, or the user would be stuck behind it.
const NATIVE_SPLASH_FAILSAFE_MS = 3000;

export default function RootLayout() {
  // Fonts are bundled, so this resolves locally. On failure we still render with system fonts.
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);
  const lockReady = useAppLockStore((s) => s.ready);

  useEffect(() => {
    const id = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), NATIVE_SPLASH_FAILSAFE_MS);
    return () => clearTimeout(id);
  }, []);

  const fontsDone = fontsLoaded || Boolean(fontError);

  return (
    <View style={{ flex: 1 }}>
      {fontsDone ? (
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
      ) : null}
      <SplashOverlay appReady={fontsDone && lockReady} />
    </View>
  );
}
