import { Trash2 } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Chip } from '../../../components/common/Chip';
import { ProgressBar } from '../../../components/common/ProgressBar';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatMl } from '../../../utils/units';
import { formatClock, weekdayLetter } from '../wellnessStats';
import { BarChart } from './BarChart';

const QUICK_AMOUNTS = [150, 250, 500];

export function WaterTab({ data, onQuickAdd, onCustom, onGoal, onDeleteLog }) {
  const { colors, spacing, touchTarget } = useTheme();
  const { water } = data;
  const progress = water.goalMl > 0 ? water.todayMl / water.goalMl : 0;
  const percent = Math.round(Math.min(progress, 1) * 100);

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="display" accessibilityLabel={`${formatMl(water.todayMl)} of ${formatMl(water.goalMl)}, ${percent} percent`}>
            {formatMl(water.todayMl)}
          </AppText>
          <AppText muted>of {formatMl(water.goalMl)}</AppText>
        </View>
        <ProgressBar progress={progress} color={colors.info} height={12} />
        <AppText variant="caption" muted>
          {water.todayMl >= water.goalMl ? 'Goal reached for today, nicely done.' : `${percent}% of today's goal`}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {QUICK_AMOUNTS.map((ml) => (
            <Chip key={ml} label={`+${ml} ml`} accessibilityLabel={`Add ${ml} millilitres`} onPress={() => onQuickAdd(ml)} />
          ))}
          <Chip label="Custom" accessibilityLabel="Add a custom amount" onPress={onCustom} />
        </View>
        <Button title={`Daily goal: ${formatMl(water.goalMl)}`} variant="soft" onPress={onGoal} accessibilityLabel={`Change daily goal, currently ${formatMl(water.goalMl)}`} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            Last 7 days
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            Avg {formatMl(water.weekAverageMl ?? 0)}/day
          </AppText>
        </View>
        <BarChart
          data={water.week.map((d) => ({ key: d.date, label: weekdayLetter(d.date), value: d.value }))}
          max={Math.max(water.goalMl, ...water.week.map((d) => d.value))}
          goal={water.goalMl}
          color={colors.info}
          summary={`Water for the last 7 days. ${water.week.map((d) => `${weekdayLetter(d.date)} ${formatMl(d.value)}`).join(', ')}.`}
        />
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">Today's drinks</AppText>
        {water.todayLogs.length === 0 ? (
          <AppText muted>Nothing logged yet today.</AppText>
        ) : (
          water.todayLogs.map((log) => (
            <Card key={log.id} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, minHeight: touchTarget }}>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">{formatMl(log.amountMl)}</AppText>
                <AppText variant="caption" muted>
                  {formatClock(log.loggedAt)}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${formatMl(log.amountMl)} logged at ${formatClock(log.loggedAt)}`}
                onPress={() => onDeleteLog(log)}
                hitSlop={8}
                style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' }}
              >
                <Trash2 color={colors.textMuted} size={20} />
              </Pressable>
            </Card>
          ))
        )}
      </View>
    </View>
  );
}
