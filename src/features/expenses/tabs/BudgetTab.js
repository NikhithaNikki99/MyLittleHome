import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { FormError } from '../../../components/common/FormError';
import { MonthSwitcher } from '../../../components/common/MonthSwitcher';
import { ProgressBar } from '../../../components/common/ProgressBar';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatMonthKey, monthKeyOf, toDateKey } from '../../../utils/dates';
import { formatPaise } from '../../../utils/money';
import { clearBudget, copyBudgetsFromPreviousMonth, getBudgetOverview, setBudget } from '../budgetService';
import { budgetStatusText } from '../expenseMath';
import { BudgetSummaryCard, CategoryBadge, LoadGate } from '../parts';
import { AmountSheet } from '../sheets';
import { useAction, useExpenseQuery } from '../useExpenseData';

function CategoryBudgetRow({ row, onEdit }) {
  const { colors, spacing } = useTheme();
  const { progress, limitPaise, spentPaise, name } = row;
  const status = progress ? budgetStatusText(progress) : null;
  const label = progress
    ? `${name}: spent ${formatPaise(spentPaise)} of ${formatPaise(limitPaise)}. ${status}`
    : `${name}: spent ${formatPaise(spentPaise)}. No budget set.`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={limitPaise ? 'Change this budget' : 'Set a budget for this category'}
      onPress={onEdit}
      style={({ pressed }) => ({ minHeight: 64, justifyContent: 'center', gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <CategoryBadge categoryId={row.categoryId} icon={row.icon} size={40} />
        <View style={{ flex: 1 }}>
          <AppText>{name}</AppText>
          <AppText variant="caption" muted>
            {progress ? `${formatPaise(spentPaise)} of ${formatPaise(limitPaise)}` : spentPaise > 0 ? `${formatPaise(spentPaise)} spent · no budget` : 'No budget set'}
          </AppText>
        </View>
        <Pencil color={colors.textMuted} size={18} />
      </View>
      {progress ? (
        <View style={{ gap: spacing.xs, paddingLeft: 40 + spacing.md }}>
          <ProgressBar progress={progress.ratio} color={progress.isAbove ? colors.secondary : colors.primary} height={8} />
          <AppText variant="caption" muted>
            {status}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function BudgetTab() {
  const { spacing } = useTheme();
  const [month, setMonth] = useState(monthKeyOf(toDateKey()));
  const [editing, setEditing] = useState(null); // { categoryId: string | null, name, limitPaise }
  const [notice, setNotice] = useState(null);
  const copyAction = useAction();
  const query = useExpenseQuery((db) => getBudgetOverview(db, month), [month]);

  const copyFromLast = async () => {
    setNotice(null);
    const ok = await copyAction.run(async (db) => {
      const added = await copyBudgetsFromPreviousMonth(db, month);
      setNotice(`Copied ${added} ${added === 1 ? 'budget' : 'budgets'} from last month.`);
    });
    if (ok) query.reload();
  };

  return (
    <>
      <MonthSwitcher
        monthKey={month}
        onChange={(m) => {
          setNotice(null);
          copyAction.setError(null);
          setMonth(m);
        }}
      />
      <LoadGate query={query}>
        {(overview) => (
          <>
            <BudgetSummaryCard
              overview={overview}
              title={`${formatMonthKey(month)} plan`}
              actionLabel={overview.overall ? 'Change monthly budget' : 'Set monthly budget'}
              onAction={() =>
                setEditing({ categoryId: null, name: 'Monthly budget', limitPaise: overview.overall?.limitPaise ?? null })
              }
            />

            <Card style={{ gap: spacing.xs }}>
              <AppText variant="heading">By category</AppText>
              <AppText variant="caption" muted>
                Optional. Tap a category to give it its own limit.
              </AppText>
              {overview.categories.map((row) => (
                <CategoryBudgetRow
                  key={row.categoryId}
                  row={row}
                  onEdit={() => setEditing({ categoryId: row.categoryId, name: row.name, limitPaise: row.limitPaise })}
                />
              ))}
            </Card>

            <View style={{ gap: spacing.sm }}>
              <Button title={copyAction.busy ? 'Copying…' : 'Copy budgets from last month'} variant="outline" onPress={copyFromLast} disabled={copyAction.busy} />
              <FormError message={copyAction.error} />
              {notice ? (
                <AppText muted accessibilityLiveRegion="polite">
                  {notice}
                </AppText>
              ) : null}
            </View>
          </>
        )}
      </LoadGate>

      <AmountSheet
        visible={editing !== null}
        title={editing ? (editing.categoryId ? `${editing.name} budget` : 'Monthly budget') : ''}
        label="Limit for the month (₹)"
        description={`For ${formatMonthKey(month)}. A budget is just a guide you can change any time.`}
        initialPaise={editing?.limitPaise ?? null}
        submitLabel="Save budget"
        onClose={() => setEditing(null)}
        onSubmit={async (db, paise) => {
          await setBudget(db, { month, categoryId: editing.categoryId, limitPaise: paise });
          query.reload();
        }}
        onClear={
          editing?.limitPaise
            ? async (db) => {
                await clearBudget(db, { month, categoryId: editing.categoryId });
                query.reload();
              }
            : null
        }
        clearLabel="Remove this budget"
      />
    </>
  );
}
