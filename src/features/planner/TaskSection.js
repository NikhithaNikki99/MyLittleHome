import { View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { TaskRow } from './TaskRow';

// A titled card of task rows. `noteFor(task)` can add a gentle caption such as "From earlier".
export function TaskSection({ title, tasks, onToggle, onEdit, noteFor, emptyText }) {
  const { spacing } = useTheme();
  if (tasks.length === 0 && !emptyText) return null;
  return (
    <Card style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {tasks.length > 0 ? (
          <AppText variant="label" muted>
            {tasks.filter((t) => t.done).length} of {tasks.length}
          </AppText>
        ) : null}
      </View>
      {tasks.length === 0 ? (
        <AppText muted>{emptyText}</AppText>
      ) : (
        tasks.map((t) => (
          <TaskRow key={t.id} task={t} note={noteFor?.(t)} onToggle={onToggle} onEdit={onEdit} />
        ))
      )}
    </Card>
  );
}
