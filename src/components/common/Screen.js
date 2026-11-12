import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { statusBarStyleFor } from '../illustrations/timeOfDay';

// Full-screen themed gradient background. `floating` renders above the scroll content
// (e.g. a floating action button) and stays put while the content scrolls.
// Set `header` to render a fixed header above the scroll area.
//
// Nothing is drawn under the status bar. Android draws the app edge to edge, so the status bar area belongs to the app;
// it is kept as an empty strip in `statusBarColor` and the scroll area starts below it. Content that scrolls up stops
// at the strip instead of sliding under the clock and icons. `statusBarColor` is the page colour unless a screen with
// its own artwork at the top (Home) passes the colour of that artwork, so the strip matches what is below it.
export function Screen({ scroll = true, children, contentStyle, floating = null, header = null, statusBarColor = null }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { colors } = theme;

  const padding = {
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl + theme.spacing.xl,
    gap: theme.spacing.lg,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.backgroundTop, colors.backgroundBottom]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Tab screens stay mounted when you leave them, so the icon colour is only set while this screen is in front. */}
      {statusBarColor && focused ? <StatusBar style={statusBarStyleFor(statusBarColor)} /> : null}
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ height: insets.top, backgroundColor: statusBarColor ?? colors.backgroundTop }}
      />
      {header}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[padding, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
      {floating}
    </View>
  );
}
