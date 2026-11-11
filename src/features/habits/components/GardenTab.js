import { Flower, Flower2, Leaf, Sprout, TreeDeciduous } from 'lucide-react-native';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatStreak } from '../habitOptions';

// One icon per growth stage. Stages come from the longest run a habit has ever had, so a plant
// only ever grows: a skipped day never makes it smaller.
const STAGE_ICONS = {
  seed: Leaf,
  sprout: Sprout,
  seedling: TreeDeciduous,
  bud: Flower,
  bloom: Flower2,
};

function Plant({ habit }) {
  const { colors, spacing, radii } = useTheme();
  const Icon = STAGE_ICONS[habit.stage.key] ?? Sprout;
  const streakText =
    habit.currentStreak > 0
      ? `Streak: ${formatStreak(habit.currentStreak, habit.streakUnit)}`
      : habit.bestStreak > 0
        ? `Best: ${formatStreak(habit.bestStreak, habit.streakUnit)}`
        : 'Ready to start';
  return (
    <Card
      accessible
      accessibilityLabel={`${habit.name}: ${habit.stage.label}. ${streakText}`}
      tone={habit.color}
      style={{ width: '48%', flexGrow: 1, alignItems: 'center', gap: spacing.xs, padding: spacing.md }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
        }}
      >
        <Icon color={habit.stage.key === 'bloom' ? colors.primary : colors.success} size={34} />
      </View>
      <AppText variant="label" style={{ textAlign: 'center' }} numberOfLines={2}>
        {habit.name}
      </AppText>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {habit.stage.label}
      </AppText>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {streakText}
      </AppText>
    </Card>
  );
}

export function GardenTab({ data }) {
  const { spacing } = useTheme();
  const plants = data.garden;

  if (plants.length === 0) {
    return <EmptyState title="Your garden is empty" message="Each habit you add becomes a plant that grows as you keep going." />;
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText muted>
        Plants grow as you build streaks. They never shrink or wilt, so a quiet day only means a pause.
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {plants.map((h) => (
          <Plant key={h.id} habit={h} />
        ))}
      </View>
    </View>
  );
}
