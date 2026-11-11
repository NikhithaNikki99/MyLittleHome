import { Target } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { ProgressBar } from '../../components/common/ProgressBar';
import { useTheme } from '../../theme/ThemeProvider';
import { formatShortDate } from '../../utils/dates';

function GoalCard({ goal, onOpen }) {
  const { colors, spacing } = useTheme();
  const subtitle = [goal.progress.label, goal.targetDate ? `by ${formatShortDate(goal.targetDate)}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.title}. ${subtitle}. ${goal.progress.percent} percent`}
      onPress={() => onOpen(goal.id)}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card tone={goal.completed ? 'accentSage' : 'surface'} style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            {goal.title}
          </AppText>
          <AppText variant="label" muted>
            {goal.progress.percent}%
          </AppText>
        </View>
        <ProgressBar progress={goal.progress.ratio} color={goal.completed ? colors.success : colors.primary} height={10} />
        <AppText variant="caption" muted>
          {subtitle}
        </AppText>
      </Card>
    </Pressable>
  );
}

export function GoalsTab({ goals, onOpen }) {
  const { colors } = useTheme();
  if (goals.length === 0) {
    return (
      <EmptyState
        icon={<Target color={colors.primary} size={32} />}
        title="No goals yet"
        message="A goal can be as big or as small as you like. Tap + to start one."
      />
    );
  }
  const open = goals.filter((g) => !g.completed);
  const done = goals.filter((g) => g.completed);
  return (
    <>
      {open.map((g) => (
        <GoalCard key={g.id} goal={g} onOpen={onOpen} />
      ))}
      {done.length > 0 ? (
        <>
          <AppText variant="heading" accessibilityRole="header">
            Completed
          </AppText>
          {done.map((g) => (
            <GoalCard key={g.id} goal={g} onOpen={onOpen} />
          ))}
        </>
      ) : null}
    </>
  );
}
