import { Droplets, Scale, Wallet } from 'lucide-react-native';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { formatShortDate } from '../../utils/dates';
import { formatPaise } from '../../utils/money';
import { formatKg, formatMl } from '../../utils/units';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/ProgressBar';

function StatTile({ icon, tone, label, value, detail, accessibilityLabel }) {
  const { colors, spacing } = useTheme();
  return (
    <Card tone={tone} style={{ flex: 1, gap: spacing.xs, padding: spacing.md }} accessible accessibilityLabel={accessibilityLabel}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {icon}
        <AppText variant="caption" muted>
          {label}
        </AppText>
      </View>
      <AppText variant="title">{value}</AppText>
      {detail ? (
        <AppText variant="caption" muted>
          {detail}
        </AppText>
      ) : null}
    </Card>
  );
}

export function SpendingCard({ spending }) {
  const { colors } = useTheme();
  const detail =
    spending.todayCount > 0
      ? `${spending.todayCount} ${spending.todayCount === 1 ? 'expense' : 'expenses'} today`
      : `${formatPaise(spending.monthExpensePaise)} this month`;
  return (
    <StatTile
      tone="surface"
      icon={<Wallet color={colors.primary} size={18} />}
      label="Spent today"
      value={formatPaise(spending.todayPaise)}
      detail={detail}
    />
  );
}

export function WeightCard({ weight }) {
  const { colors } = useTheme();
  let detail = 'Log whenever you like';
  if (weight) {
    detail = formatShortDate(weight.date);
    if (weight.previousKg !== null) {
      const diff = Math.round((weight.kg - weight.previousKg) * 100) / 100;
      // Neutral wording on purpose: no praise or blame for the direction of change.
      if (diff !== 0) detail += ` · ${diff > 0 ? '+' : '−'}${Math.abs(diff)} kg`;
    }
  }
  return (
    <StatTile
      tone="surface"
      icon={<Scale color={colors.info} size={18} />}
      label="Weight"
      value={weight ? formatKg(weight.kg) : '— kg'}
      detail={detail}
    />
  );
}

export function WaterCard({ water }) {
  const { colors, spacing } = useTheme();
  const progress = water.goalMl > 0 ? water.totalMl / water.goalMl : 0;
  const percent = Math.round(Math.min(progress, 1) * 100);
  return (
    <Card
      style={{ gap: spacing.sm, padding: spacing.md }}
      accessible
      accessibilityLabel={`Water: ${formatMl(water.totalMl)} of ${formatMl(water.goalMl)}, ${percent} percent`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Droplets color={colors.info} size={18} />
        <AppText variant="caption" muted style={{ flex: 1 }}>
          Water
        </AppText>
        <AppText variant="label">
          {formatMl(water.totalMl)} / {formatMl(water.goalMl)}
        </AppText>
      </View>
      <ProgressBar progress={progress} color={colors.info} height={10} />
      {water.totalMl >= water.goalMl ? (
        <AppText variant="caption" muted>
          Goal reached, nicely done
        </AppText>
      ) : null}
    </Card>
  );
}
