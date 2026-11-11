import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { useTheme } from '../../../theme/ThemeProvider';
import { relativeDayLabel, formatDuration, weekdayLetter } from '../wellnessStats';
import { BarChart } from './BarChart';

export function SleepTab({ data, onAdd, onEdit, onGoal }) {
  const { colors, spacing, touchTarget } = useTheme();
  const { sleep } = data;
  const week = sleep.week;
  const barMax = Math.max(sleep.goalMinutes, ...week.map((d) => d.value ?? 0));

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="display">{sleep.last ? formatDuration(sleep.last.minutes) : '—'}</AppText>
          <AppText muted>{sleep.last ? relativeDayLabel(sleep.last.date, data.today) : 'Nothing logged yet'}</AppText>
        </View>
        <AppText variant="caption" muted>
          {sleep.weekAverageMinutes === null
            ? 'Log a night to see your weekly average.'
            : `Average this week: ${formatDuration(sleep.weekAverageMinutes)} (nights you logged)`}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Log sleep" onPress={onAdd} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={`Goal ${formatDuration(sleep.goalMinutes)}`}
              variant="soft"
              onPress={onGoal}
              accessibilityLabel={`Change sleep goal, currently ${formatDuration(sleep.goalMinutes)}`}
            />
          </View>
        </View>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Last 7 days</AppText>
        <BarChart
          data={week.map((d) => ({ key: d.date, label: weekdayLetter(d.date), value: d.value }))}
          max={barMax}
          goal={sleep.goalMinutes}
          color={colors.secondary}
          summary={`Sleep for the last 7 days. ${week
            .map((d) => `${weekdayLetter(d.date)} ${d.value === null ? 'not logged' : formatDuration(d.value)}`)
            .join(', ')}. Goal ${formatDuration(sleep.goalMinutes)}.`}
        />
        <AppText variant="caption" muted>
          Empty days mean nothing was logged.
        </AppText>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">Recent nights</AppText>
        {sleep.entries.length === 0 ? (
          <EmptyState title="No sleep logged yet" message="Add a night whenever you like." />
        ) : (
          sleep.entries.map((e) => (
            <Pressable
              key={e.date}
              accessibilityRole="button"
              accessibilityLabel={`${formatDuration(e.minutes)} on ${relativeDayLabel(e.date, data.today)}${e.quality ? `, rested ${e.quality} of 5` : ''}. Edit`}
              onPress={() => onEdit(e)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: touchTarget }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading">{formatDuration(e.minutes)}</AppText>
                  <AppText variant="caption" muted>
                    {relativeDayLabel(e.date, data.today)}
                    {e.quality ? ` · rested ${e.quality}/5` : ''}
                  </AppText>
                </View>
                <ChevronRight color={colors.textMuted} size={20} />
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}
