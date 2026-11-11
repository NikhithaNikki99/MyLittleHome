import { View } from 'react-native';
import { Button } from '../../components/common/Button';
import { CalendarMonth } from '../../components/common/CalendarMonth';
import { Card } from '../../components/common/Card';
import { MonthSwitcher } from '../../components/common/MonthSwitcher';
import { useTheme } from '../../theme/ThemeProvider';
import { formatLongDate } from '../../utils/dates';
import { TaskSection } from './TaskSection';

export function MonthTab({ monthKey, onMonthChange, selectedDate, onSelectDate, markedDates, tasks, onToggle, onEdit, onAdd }) {
  const { spacing } = useTheme();
  return (
    <>
      <MonthSwitcher monthKey={monthKey} onChange={onMonthChange} />
      <Card>
        <CalendarMonth monthKey={monthKey} selectedDate={selectedDate} markedDates={markedDates} onSelect={onSelectDate} />
      </Card>
      <TaskSection
        title={formatLongDate(selectedDate)}
        tasks={tasks}
        onToggle={onToggle}
        onEdit={onEdit}
        noteFor={(t) => (t.overdue ? 'From earlier' : undefined)}
        emptyText="Nothing planned for this day."
      />
      <View style={{ paddingBottom: spacing.sm }}>
        <Button title="Add a to-do for this day" variant="soft" onPress={onAdd} />
      </View>
    </>
  );
}
