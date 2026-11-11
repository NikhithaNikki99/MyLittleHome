import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatShortDate } from '../../../utils/dates';
import { formatKg } from '../../../utils/units';
import { describeWeightChange, roundKg } from '../wellnessStats';
import { WeightChart } from './WeightChart';

const CHART_POINTS = 14;

export function WeightTab({ data, onAdd, onEdit, onGoal }) {
  const { colors, spacing, touchTarget } = useTheme();
  const { entries, latest, goalKg } = data.weight;

  if (entries.length === 0) {
    return (
      <View style={{ gap: spacing.lg }}>
        <EmptyState title="No weight entries yet" message="Add one whenever you like. There's no schedule to keep." />
        <Button title="Log weight" onPress={onAdd} />
      </View>
    );
  }

  const chronological = entries.slice(0, CHART_POINTS).reverse();
  const first = chronological[0];
  const last = chronological[chronological.length - 1];
  const summary = `Weight over the last ${chronological.length} entries, from ${formatKg(first.kg)} on ${formatShortDate(first.date)} to ${formatKg(last.kg)} on ${formatShortDate(last.date)}.`;

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="display">{formatKg(latest.kg)}</AppText>
          <AppText muted>{formatShortDate(latest.date)}</AppText>
        </View>
        <WeightChart points={chronological.map((e) => ({ key: e.id, kg: e.kg }))} goalKg={goalKg} summary={summary} />
        <AppText variant="caption" muted>
          {chronological.length < 2 ? 'Add another entry to see a line.' : summary}
        </AppText>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="label" muted>
            {goalKg === null ? 'No goal set (optional)' : `Goal ${formatKg(goalKg)}`}
          </AppText>
          <Button title={goalKg === null ? 'Set goal' : 'Change goal'} variant="soft" onPress={onGoal} />
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">History</AppText>
        {entries.map((e, i) => {
          const older = entries[i + 1];
          const change = older ? describeWeightChange(roundKg(e.kg - older.kg)) : 'First entry';
          return (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${formatKg(e.kg)} on ${formatShortDate(e.date)}, ${change}. Edit`}
              onPress={() => onEdit(e)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: touchTarget }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{formatKg(e.kg)}</AppText>
                  <AppText variant="caption" muted>
                    {formatShortDate(e.date)} · {change}
                  </AppText>
                  {e.note ? (
                    <AppText variant="caption" muted numberOfLines={1}>
                      {e.note}
                    </AppText>
                  ) : null}
                </View>
                <ChevronRight color={colors.textMuted} size={20} />
              </Card>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
