import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// Floating round "+" button, pinned bottom-right above the tab bar. Pass as Screen's `floating`.
export function Fab({ onPress, label }) {
  const { colors, shadow } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: 20,
          bottom: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
        shadow,
      ]}
    >
      <Plus color={colors.onPrimary} size={28} />
    </Pressable>
  );
}
