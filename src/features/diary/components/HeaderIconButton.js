import { Pressable } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';

// 48dp icon button for screen headers. `selected` shows a soft background (used for toggles).
export function HeaderIconButton({ Icon, label, selected = false, filled = false, onPress }) {
  const { colors, radii, touchTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: touchTarget,
        height: touchTarget,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.primarySoft : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon
        color={selected ? colors.primary : colors.text}
        size={22}
        fill={filled && selected ? colors.primary : 'none'}
      />
    </Pressable>
  );
}
