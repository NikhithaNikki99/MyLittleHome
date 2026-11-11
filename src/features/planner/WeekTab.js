import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { useTheme } from '../../theme/ThemeProvider';
import { addDays, formatLongDate, parseDateKey, toDateKey } from '../../utils/dates';
import { TaskSection } from './TaskSection';
import { formatWeekRange, WEEKDAYS_MON_FIRST } from './plannerDates';

function WeekSwitcher({ anchor, onChange }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  const arrow = (days, label, Icon) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onChange(addDays(anchor, days))}
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
      {arrow(-7, 'Previous week', ChevronLeft)}
      <AppText variant="label" style={{ minWidth: 150, textAlign: 'center' }}>
        {formatWeekRange(anchor)}
      </AppText>
      {arrow(7, 'Next week', ChevronRight)}
    </View>
  );
}

function DayCell({ day, selected, onPress }) {
  const { colors, spacing, radii } = useTheme();
  const isToday = day.dateKey === toDateKey();
  const weekday = WEEKDAYS_MON_FIRST[(parseDateKey(day.dateKey).getDay() + 6) % 7];
  const countText = day.total === 0 ? 'no tasks' : `${day.open} open of ${day.total}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatLongDate(day.dateKey)}, ${countText}${isToday ? ', today' : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 72,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        borderRadius: radii.md,
        borderWidth: isToday && !selected ? 1.5 : 0,
        borderColor: colors.primary,
        backgroundColor: selected ? colors.primary : colors.surface,
      }}
    >
      <AppText variant="caption" color={selected ? colors.onPrimary : colors.textMuted}>
        {weekday}
      </AppText>
      <AppText variant="label" color={selected ? colors.onPrimary : colors.text}>
        {parseDateKey(day.dateKey).getDate()}
      </AppText>
      <View
        accessible={false}
        style={{
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 4,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: day.total === 0 ? 'transparent' : selected ? colors.onPrimary : colors.primarySoft,
        }}
      >
        {day.total > 0 ? (
          <AppText variant="caption" style={{ lineHeight: 16 }} color={selected ? colors.primary : colors.text}>
            {day.total}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

export function WeekTab({ anchor, onAnchorChange, week, selectedDate, onSelectDate, tasks, onToggle, onEdit }) {
  const { spacing } = useTheme();
  return (
    <>
      <WeekSwitcher anchor={anchor} onChange={onAnchorChange} />
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {week.map((day) => (
          <DayCell
            key={day.dateKey}
            day={day}
            selected={day.dateKey === selectedDate}
            onPress={() => onSelectDate(day.dateKey)}
          />
        ))}
      </View>
      <TaskSection
        title={formatLongDate(selectedDate)}
        tasks={tasks}
        onToggle={onToggle}
        onEdit={onEdit}
        noteFor={(t) => (t.overdue ? 'From earlier' : undefined)}
        emptyText="Nothing planned for this day."
      />
    </>
  );
}
