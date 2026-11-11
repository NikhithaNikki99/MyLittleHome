import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { useTheme } from '../../../theme/ThemeProvider';
import { PIN_MAX_LENGTH } from '../appLockLogic';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];

// On-screen number pad (no system keyboard, so nothing is cached by an input method).
// `value` is the digits entered so far; the parent owns the state.
export function PinPad({ value, onChange, disabled = false, dotCount = PIN_MAX_LENGTH }) {
  const { colors, spacing, radii } = useTheme();

  const press = (key) => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    if (key === 'back') onChange(value.slice(0, -1));
    else if (value.length < PIN_MAX_LENGTH) onChange(value + key);
  };

  return (
    <View style={{ gap: spacing.xl, alignItems: 'center' }}>
      <View
        accessible
        accessibilityLabel={`${value.length} digits entered`}
        style={{ flexDirection: 'row', gap: spacing.md, minHeight: 20 }}
      >
        {Array.from({ length: dotCount }, (_, i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: colors.primary,
              backgroundColor: i < value.length ? colors.primary : 'transparent',
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 3 * 88 + 2 * spacing.md, gap: spacing.md }}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={`gap-${i}`} style={{ width: 88, height: 64 }} />
          ) : (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? 'Delete last digit' : key}
              accessibilityState={{ disabled }}
              onPress={() => press(key)}
              style={({ pressed }) => ({
                width: 88,
                height: 64,
                borderRadius: radii.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.primarySoft : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: disabled ? 0.5 : 1,
              })}
            >
              {key === 'back' ? (
                <Delete color={colors.text} size={24} />
              ) : (
                <AppText variant="title">{key}</AppText>
              )}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}
