import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { CalendarMonth } from '../../components/common/CalendarMonth';
import { Chip } from '../../components/common/Chip';
import { MonthSwitcher } from '../../components/common/MonthSwitcher';
import { useTheme } from '../../theme/ThemeProvider';
import { addDays, formatLongDate, monthKeyOf, toDateKey } from '../../utils/dates';

// Date chosen with quick chips and, on request, an in-app calendar. `value` is 'YYYY-MM-DD' or null.
// `allowNone` adds a "Someday" chip that sets null; goals use it as "No date".
export function DatePickerField({ label, value, onChange, allowNone = true, noneLabel = 'Someday', showTomorrow = true }) {
  const { spacing } = useTheme();
  const today = toDateKey();
  const tomorrow = addDays(today, 1);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(monthKeyOf(value ?? today));

  const isQuick = value === today || (showTomorrow && value === tomorrow) || value === null;

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip label="Today" selected={value === today} onPress={() => onChange(today)} />
        {showTomorrow ? <Chip label="Tomorrow" selected={value === tomorrow} onPress={() => onChange(tomorrow)} /> : null}
        {allowNone ? <Chip label={noneLabel} selected={value === null} onPress={() => onChange(null)} /> : null}
        <Chip
          label={value && !isQuick ? formatLongDate(value) : 'Pick a date'}
          selected={(value !== null && !isQuick) || calendarOpen}
          accessibilityLabel={calendarOpen ? 'Hide calendar' : 'Pick a date from the calendar'}
          onPress={() => {
            if (value) setMonthKey(monthKeyOf(value));
            setCalendarOpen((open) => !open);
          }}
        />
      </View>
      {calendarOpen ? (
        <View style={{ gap: spacing.sm }}>
          <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />
          <CalendarMonth
            monthKey={monthKey}
            selectedDate={value}
            onSelect={(key) => {
              onChange(key);
              setCalendarOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
