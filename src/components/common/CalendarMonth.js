import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { buildMonthGrid } from '../../utils/calendarGrid';
import { toDateKey } from '../../utils/dates';
import { AppText } from './AppText';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// `markedDates`: Set of 'YYYY-MM-DD' to show a dot under. `selectedDate` is filled with the primary colour.
export function CalendarMonth({ monthKey, selectedDate, markedDates, onSelect }) {
  const { colors, spacing } = useTheme();
  const weeks = buildMonthGrid(monthKey);
  const today = toDateKey();

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="caption" muted accessibilityElementsHidden importantForAccessibility="no">
              {w}
            </AppText>
          </View>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0].dateKey} style={{ flexDirection: 'row' }}>
          {week.map((cell) => {
            const selected = cell.dateKey === selectedDate;
            const isToday = cell.dateKey === today;
            const marked = markedDates?.has(cell.dateKey);
            return (
              <Pressable
                key={cell.dateKey}
                disabled={!cell.inMonth}
                accessibilityRole="button"
                accessibilityLabel={`${cell.dateKey}${marked ? ', has entries' : ''}${isToday ? ', today' : ''}`}
                accessibilityState={{ selected, disabled: !cell.inMonth }}
                onPress={() => onSelect?.(cell.dateKey)}
                style={{ flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' }}
              >
                {cell.inMonth ? (
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? colors.primary : 'transparent',
                      borderWidth: isToday && !selected ? 1.5 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    <AppText variant="label" color={selected ? colors.onPrimary : colors.text}>
                      {cell.day}
                    </AppText>
                    {marked && !selected ? (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 3,
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: colors.primary,
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
