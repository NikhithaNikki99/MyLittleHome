import { useState } from 'react';
import { View } from 'react-native';
import { DonutChart } from '../../components/charts/DonutChart';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { MonthSwitcher } from '../../components/common/MonthSwitcher';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme } from '../../theme/ThemeProvider';
import { monthKeyOf, toDateKey } from '../../utils/dates';
import { formatPaise } from '../../utils/money';
import { getCategoryStyle } from './categoryStyle';
import { getMonthBreakdown } from './expenseService';
import { CategoryBadge, LoadGate } from './parts';
import { useExpenseQuery } from './useExpenseData';

function CategoryRow({ row }) {
  const { spacing, radii } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${row.name}: ${formatPaise(row.totalPaise)}, ${row.percent} percent`}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
    >
      <View style={{ width: 6, alignSelf: 'stretch', marginVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: row.color }} />
      <CategoryBadge categoryId={row.categoryId} icon={row.icon} size={40} />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1}>{row.name}</AppText>
        <AppText variant="caption" muted>
          {row.count} {row.count === 1 ? 'entry' : 'entries'}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText variant="heading">{formatPaise(row.totalPaise)}</AppText>
        <AppText variant="caption" muted>
          {row.percent}%
        </AppText>
      </View>
    </View>
  );
}

export default function BreakdownScreen() {
  const { colors, spacing } = useTheme();
  const [month, setMonth] = useState(monthKeyOf(toDateKey()));
  const query = useExpenseQuery((db) => getMonthBreakdown(db, month), [month]);

  return (
    <Screen>
      <ScreenHeader title="Breakdown" back />
      <MonthSwitcher monthKey={month} onChange={setMonth} />

      <LoadGate query={query}>
        {(b) => {
          const rows = b.categories.map((c) => ({ ...c, color: colors[getCategoryStyle(c.categoryId, c.icon).chart] }));
          return (
            <>
              {rows.length === 0 ? (
                <EmptyState title="No spending this month" message="Once you add expenses, you'll see where they went here." />
              ) : (
                <>
                  <View
                    style={{ alignItems: 'center' }}
                    accessible
                    accessibilityLabel={`Total spent ${formatPaise(b.expensePaise)}. ${rows.map((r) => `${r.name} ${r.percent} percent`).join(', ')}.`}
                  >
                    <DonutChart segments={rows.map((r) => ({ key: r.categoryId, value: r.totalPaise, color: r.color }))} size={220} strokeWidth={30}>
                      <AppText variant="caption" muted>
                        Total
                      </AppText>
                      <AppText variant="title">{formatPaise(b.expensePaise)}</AppText>
                    </DonutChart>
                  </View>
                  <Card style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
                    {rows.map((r) => (
                      <CategoryRow key={r.categoryId} row={r} />
                    ))}
                  </Card>
                </>
              )}

              <Card style={{ gap: spacing.sm }}>
                <AppText variant="heading">This month</AppText>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText muted>Spent</AppText>
                  <AppText variant="label">{formatPaise(b.expensePaise)}</AppText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText muted>Income</AppText>
                  <AppText variant="label" color={colors.success}>
                    {formatPaise(b.incomePaise)}
                  </AppText>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText muted>Income minus spent</AppText>
                  <AppText variant="label">{formatPaise(b.incomePaise - b.expensePaise)}</AppText>
                </View>
              </Card>
            </>
          );
        }}
      </LoadGate>
    </Screen>
  );
}
