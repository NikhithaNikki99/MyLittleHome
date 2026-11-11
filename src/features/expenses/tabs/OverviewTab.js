import { ChevronRight, PieChart } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { useTheme } from '../../../theme/ThemeProvider';
import { monthKeyOf, toDateKey } from '../../../utils/dates';
import { getCategoryStyle } from '../categoryStyle';
import { getBudgetOverview } from '../budgetService';
import { getRecentExpenses } from '../expenseService';
import { BudgetSummaryCard, LoadGate, TransactionRow, useExpenseNavigation } from '../parts';
import { getSubscriptionsSummary, postDueRecurring } from '../recurringService';
import { SubscriptionsCard } from '../SubscriptionsCard';
import { useExpenseQuery } from '../useExpenseData';

const COLUMNS = 4;

// Four tiles per row leave no room for long names; the full name stays in the accessibility label.
const SHORT_TILE_NAMES = { 'cat-entertainment': 'Fun', 'cat-personal-care': 'Personal' };

function chunk(items, size) {
  const rows = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function QuickAddGrid({ categories, onPick }) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {chunk(categories, COLUMNS).map((row) => (
        <View key={row[0].categoryId} style={{ flexDirection: 'row', gap: spacing.sm }}>
          {row.map((c) => {
            const { Icon, tone } = getCategoryStyle(c.categoryId, c.icon);
            return (
              <Pressable
                key={c.categoryId}
                accessibilityRole="button"
                accessibilityLabel={`Add ${c.name} expense`}
                onPress={() => onPick(c.categoryId)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 84,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  paddingHorizontal: spacing.xs,
                  borderRadius: radii.md,
                  backgroundColor: colors[tone],
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Icon color={colors.text} size={24} />
                <AppText variant="caption" numberOfLines={2} style={{ fontWeight: '600', textAlign: 'center' }}>
                  {SHORT_TILE_NAMES[c.categoryId] ?? c.name}
                </AppText>
              </Pressable>
            );
          })}
          {Array.from({ length: COLUMNS - row.length }, (_, i) => (
            <View key={`pad-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function OverviewTab({ onOpenBudget }) {
  const { colors, spacing } = useTheme();
  const nav = useExpenseNavigation();
  const query = useExpenseQuery(async (db) => {
    await postDueRecurring(db).catch(() => {});
    const [overview, recent, subscriptions] = await Promise.all([
      getBudgetOverview(db, monthKeyOf(toDateKey())),
      getRecentExpenses(db, 5),
      getSubscriptionsSummary(db),
    ]);
    return { overview, recent, subscriptions };
  }, []);

  return (
    <LoadGate query={query}>
      {({ overview, recent, subscriptions }) => (
        <>
          <BudgetSummaryCard
            overview={overview}
            actionLabel={overview.overall ? null : 'Set a monthly budget'}
            onAction={overview.overall ? undefined : onOpenBudget}
          />

          <SubscriptionsCard summary={subscriptions} onPress={nav.openSubscriptions} />

          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading">Quick Add</AppText>
            <QuickAddGrid categories={overview.categories} onPick={(categoryId) => nav.addExpense({ categoryId })} />
          </View>

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="heading">Recent Expenses</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See where your money went this month"
                onPress={nav.openBreakdown}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
              >
                <PieChart color={colors.primary} size={18} />
                <AppText variant="label" color={colors.primary}>
                  Breakdown
                </AppText>
                <ChevronRight color={colors.primary} size={18} />
              </Pressable>
            </View>
            {recent.length === 0 ? (
              <EmptyState title="Nothing logged yet" message="Tap a category above or the + button to add your first expense." />
            ) : (
              <Card style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
                {recent.map((item) => (
                  <TransactionRow key={item.id} item={item} onPress={() => nav.editTransaction(item.id)} />
                ))}
              </Card>
            )}
          </View>
        </>
      )}
    </LoadGate>
  );
}
