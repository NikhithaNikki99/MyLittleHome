import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { formatMonthKey, shiftMonth } from '../../utils/dates';
import { AppText } from './AppText';

// `monthKey` is 'YYYY-MM'. Calls onChange with the new 'YYYY-MM'.
export function MonthSwitcher({ monthKey, onChange }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  const arrow = (delta, label, Icon) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onChange(shiftMonth(monthKey, delta))}
      style={{ width: touchTarget - 8, height: touchTarget - 8, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon color={colors.text} size={20} />
    </Pressable>
  );
  return (
    <View
      style={{
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {arrow(-1, 'Previous month', ChevronLeft)}
      <AppText variant="label" style={{ minWidth: 88, textAlign: 'center' }}>
        {formatMonthKey(monthKey)}
      </AppText>
      {arrow(1, 'Next month', ChevronRight)}
    </View>
  );
}
