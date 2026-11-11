import { CalendarCheck } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { EmptyState } from '../../components/common/EmptyState';
import { TaskSection } from './TaskSection';

const FROM_EARLIER = (t) => (t.overdue ? 'From earlier' : undefined);

export function TodayTab({ groups, onToggle, onEdit }) {
  const { colors } = useTheme();
  const total = groups.earlier.length + groups.today.length + groups.someday.length;

  if (total === 0) {
    return (
      <EmptyState
        icon={<CalendarCheck color={colors.primary} size={32} />}
        title="A clear day"
        message="Nothing planned. Tap + to add a small thing, or enjoy the space."
      />
    );
  }

  return (
    <>
      <TaskSection title="Today" tasks={groups.today} onToggle={onToggle} onEdit={onEdit} emptyText="Nothing due today." />
      <TaskSection
        title="From earlier"
        tasks={groups.earlier}
        onToggle={onToggle}
        onEdit={onEdit}
        noteFor={FROM_EARLIER}
      />
      <TaskSection title="Someday" tasks={groups.someday} onToggle={onToggle} onEdit={onEdit} />
    </>
  );
}
