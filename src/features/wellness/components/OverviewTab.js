import { Droplets, Moon, Scale, Smile } from 'lucide-react-native';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Card } from '../../../components/common/Card';
import { ProgressBar } from '../../../components/common/ProgressBar';
import { MOODS } from '../../../constants/moods';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatKg, formatMl } from '../../../utils/units';
import { describeWeightChange, formatDuration, moodSummary, relativeDayLabel, roundKg, weekdayLetter, weightGoalProgress } from '../wellnessStats';
import { BarChart } from './BarChart';

function StatTile({ icon, tone, label, value, detail }) {
  const { spacing } = useTheme();
  return (
    <Card
      tone={tone}
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
      style={{ width: '48%', flexGrow: 1, gap: spacing.xs, padding: spacing.md }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {icon}
        <AppText variant="caption" muted>
          {label}
        </AppText>
      </View>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" muted>
        {detail || ' '}
      </AppText>
    </Card>
  );
}

function MoodStrip({ series }) {
  const { colors, spacing, radii } = useTheme();
  const summary = moodSummary(series);
  const text =
    summary.logged === 0
      ? 'No moods logged in the last 30 days yet.'
      : `${summary.logged} of ${summary.total} days logged. Most often: ${summary.topLabel}.`;
  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="heading">Mood, last 30 days</AppText>
      <View
        accessible
        accessibilityLabel={`Mood strip. ${text}`}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}
      >
        {series.map((d) => {
          const mood = MOODS.find((m) => m.value === d.value);
          return (
            <View
              key={d.date}
              style={{
                width: 18,
                height: 18,
                borderRadius: radii.sm / 2,
                backgroundColor: mood ? colors[mood.tone] : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          );
        })}
      </View>
      <AppText variant="caption" muted>
        {text}
      </AppText>
    </Card>
  );
}

export function OverviewTab({ data }) {
  const { colors, spacing } = useTheme();
  const { weight, water, sleep, mood } = data;
  const todayMood = MOODS.find((m) => m.value === mood.today);

  let weightDetail = 'Log whenever you like';
  if (weight.latest) {
    weightDetail = relativeDayLabel(weight.latest.date, data.today);
    if (weight.previousKg !== null) weightDetail += ` · ${describeWeightChange(weight.latest.kg - weight.previousKg)}`;
  }

  const goal = weight.latest && weight.startKg !== null
    ? weightGoalProgress({ startKg: weight.startKg, currentKg: weight.latest.kg, goalKg: weight.goalKg })
    : null;

  const waterBars = water.week.map((d) => ({
    key: d.date,
    label: weekdayLetter(d.date),
    value: d.value,
  }));

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <StatTile
          tone="accentBlue"
          icon={<Scale color={colors.info} size={18} />}
          label="Weight"
          value={weight.latest ? formatKg(weight.latest.kg) : '— kg'}
          detail={weightDetail}
        />
        <StatTile
          tone="accentSage"
          icon={<Droplets color={colors.info} size={18} />}
          label="Water today"
          value={formatMl(water.todayMl)}
          detail={`of ${formatMl(water.goalMl)}`}
        />
        <StatTile
          tone="accentLavender"
          icon={<Moon color={colors.secondary} size={18} />}
          label="Last sleep"
          value={sleep.last ? formatDuration(sleep.last.minutes) : '—'}
          detail={sleep.last ? relativeDayLabel(sleep.last.date, data.today) : 'Nothing logged yet'}
        />
        <StatTile
          tone="accentButter"
          icon={<Smile color={colors.primary} size={18} />}
          label="Mood today"
          value={todayMood ? todayMood.label : '—'}
          detail={todayMood ? ' ' : 'Pick one on Home'}
        />
      </View>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="heading">Weight</AppText>
        {weight.latest && weight.startKg !== null ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText muted>Start {formatKg(weight.startKg)}</AppText>
              <AppText variant="label">Now {formatKg(weight.latest.kg)}</AppText>
            </View>
            {goal ? (
              <>
                <ProgressBar progress={goal.fraction} color={colors.primary} height={10} />
                <AppText variant="caption" muted>
                  {goal.remainingKg === 0
                    ? `You've reached your goal of ${formatKg(weight.goalKg)}.`
                    : `${formatKg(goal.remainingKg)} to your goal of ${formatKg(weight.goalKg)}.`}
                </AppText>
              </>
            ) : (
              <AppText variant="caption" muted>
                {weight.goalKg === null
                  ? `${describeWeightChange(roundKg(weight.latest.kg - weight.startKg))} since your first entry. Set an optional goal on the Weight tab.`
                  : ''}
              </AppText>
            )}
          </>
        ) : (
          <AppText muted>Add your first weight on the Weight tab to see it here.</AppText>
        )}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            Water this week
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            Avg {formatMl(water.weekAverageMl ?? 0)}/day
          </AppText>
        </View>
        <BarChart
          data={waterBars}
          max={Math.max(water.goalMl, ...water.week.map((d) => d.value))}
          goal={water.goalMl}
          color={colors.info}
          summary={`Water this week. ${water.week.map((d) => `${weekdayLetter(d.date)} ${formatMl(d.value)}`).join(', ')}. Goal ${formatMl(water.goalMl)} a day.`}
        />
      </Card>

      <MoodStrip series={mood.series} />
    </View>
  );
}
