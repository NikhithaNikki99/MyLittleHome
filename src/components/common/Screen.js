import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

// Full-screen themed gradient background. `floating` renders above the scroll content
// (e.g. a floating action button) and stays put while the content scrolls.
// Set `header` to render a fixed header above the scroll area.
export function Screen({ scroll = true, children, contentStyle, floating = null, header = null, edgeToEdgeTop = false }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { colors } = theme;

  const padding = {
    paddingTop: edgeToEdgeTop ? 0 : insets.top + theme.spacing.lg,
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
