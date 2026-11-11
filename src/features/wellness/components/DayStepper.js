import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { useTheme } from '../../../theme/ThemeProvider';
import { addDays, formatLongDate, toDateKey } from '../../../utils/dates';
import { relativeDayLabel } from '../wellnessStats';

// Pick a past or current day with arrows (no typing, so the date is always valid). Future days are
// not offered.
export function DayStepper({ label, value, onChange }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  const today = toDateKey();
  const atToday = value >= today;

  const arrow = (direction, disabled) => ({
    accessibilityRole: 'button',
    accessibilityLabel: direction < 0 ? 'Previous day' : 'Next day',
    accessibilityState: { disabled },
    disabled,
    onPress: () => onChange(addDays(value, direction)),
    style: {
      width: touchTarget,
      height: touchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.35 : 1,
    },
  });

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable {...arrow(-1, false)}>
          <ChevronLeft color={colors.text} size={24} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${label}: ${formatLongDate(value)}`}>
          <AppText variant="label">{relativeDayLabel(value, today)}</AppText>
          <AppText variant="caption" muted>
            {formatLongDate(value)}
          </AppText>
        </View>
        <Pressable {...arrow(1, atToday)}>
          <ChevronRight color={colors.text} size={24} />
        </Pressable>
      </View>
    </View>
  );
}
