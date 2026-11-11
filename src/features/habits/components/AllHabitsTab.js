import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { useTheme } from '../../../theme/ThemeProvider';
import { HabitIcon } from '../habitIcons';
import { describeSchedule } from '../habitOptions';

function IconButton({ label, onPress, children }) {
  const { touchTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      {children}
    </Pressable>
  );
}

function HabitRow({ habit, onEdit, onArchive, onDelete }) {
  const { colors, spacing, radii } = useTheme();
  const detail = [
    describeSchedule(habit.weekdays),
    habit.targetCount > 1 ? `${habit.targetCount}× a day` : null,
    habit.archived ? 'Archived' : habit.currentStreak > 0 ? `${habit.currentStreak}-day streak` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card style={{ gap: spacing.sm, padding: spacing.md, opacity: habit.archived ? 0.8 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors[habit.color] ?? colors.accentSage,
          }}
        >
          <HabitIcon name={habit.icon} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{habit.name}</AppText>
          <AppText variant="caption" muted>
            {detail}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <IconButton label={`Edit ${habit.name}`} onPress={() => onEdit(habit)}>
          <Pencil color={colors.text} size={20} />
        </IconButton>
        <IconButton label={`${habit.archived ? 'Restore' : 'Archive'} ${habit.name}`} onPress={() => onArchive(habit)}>
          {habit.archived ? <ArchiveRestore color={colors.text} size={20} /> : <Archive color={colors.text} size={20} />}
        </IconButton>
        <IconButton label={`Delete ${habit.name}`} onPress={() => onDelete(habit)}>
          <Trash2 color={colors.danger} size={20} />
        </IconButton>
      </View>
    </Card>
  );
}

export function AllHabitsTab({ data, onCreate, onEdit, onArchive, onDelete }) {
  const { spacing } = useTheme();
  const active = data.habits.filter((h) => !h.archived);
  const archived = data.habits.filter((h) => h.archived);

  if (data.habits.length === 0) {
    return (
      <View style={{ gap: spacing.lg }}>
        <EmptyState title="No habits yet" message="Start with something small. You can change it any time." />
        <Button title="Create a habit" onPress={onCreate} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        {active.map((h) => (
          <HabitRow key={h.id} habit={h} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} />
        ))}
      </View>
      {archived.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">Archived</AppText>
          <AppText variant="caption" muted>
            Hidden from Today and the garden. Your history is kept.
          </AppText>
          {archived.map((h) => (
            <HabitRow key={h.id} habit={h} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
