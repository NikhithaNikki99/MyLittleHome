import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

// Serif italic title, with an optional back button (sub-screens) and a trailing action slot.
export function ScreenHeader({ title, back = false, trailing = null, centered = false }) {
  const router = useRouter();
  const { colors, spacing, touchTarget } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget }}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={8}
          style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft color={colors.text} size={26} />
        </Pressable>
      ) : null}
      <AppText
        variant={back || centered ? 'heading' : 'screenTitle'}
        accessibilityRole="header"
        style={{ flex: 1, textAlign: centered || back ? 'center' : 'left' }}
      >
        {title}
      </AppText>
      {back ? <View style={{ width: touchTarget, alignItems: 'center' }}>{trailing}</View> : trailing}
    </View>
  );
}
