import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Card } from '../../../components/common/Card';
import { Chip } from '../../../components/common/Chip';
import { EmptyState } from '../../../components/common/EmptyState';
import { MonthSwitcher } from '../../../components/common/MonthSwitcher';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatShortDate, monthKeyOf, toDateKey } from '../../../utils/dates';
import { formatPaise } from '../../../utils/money';
import { getMonthHistory, listActiveCategories } from '../expenseService';
import { LoadGate, TransactionRow, useExpenseNavigation } from '../parts';
import { useExpenseQuery } from '../useExpenseData';

function SearchField({ value, onChangeText }) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  return (
    <View
      style={{
        minHeight: theme.touchTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.pill,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Search color={colors.textMuted} size={20} />
      <TextInput
        accessibilityLabel="Search entries"
        value={value}
        onChangeText={onChangeText}
        placeholder="Search title or notes"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={[theme.typography.body, { flex: 1, color: colors.text, minHeight: theme.touchTarget }]}
      />
    </View>
  );
}

function DaySection({ day, onOpen }) {
  const { spacing } = useTheme();
  const totals = [
    day.expensePaise > 0 ? `${formatPaise(day.expensePaise)} spent` : null,
    day.incomePaise > 0 ? `+${formatPaise(day.incomePaise)} in` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: spacing.xs }}>
        <AppText variant="label">{formatShortDate(day.date)}</AppText>
        <AppText variant="caption" muted>
          {totals}
        </AppText>
      </View>
      <Card style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
        {day.items.map((item) => (
          <TransactionRow key={item.id} item={item} showDate={false} onPress={() => onOpen(item.id)} />
        ))}
      </Card>
    </View>
  );
}

export function HistoryTab() {
  const { spacing } = useTheme();
  const nav = useExpenseNavigation();
  const [month, setMonth] = useState(monthKeyOf(toDateKey()));
  const [categoryId, setCategoryId] = useState(null);
  const [search, setSearch] = useState('');

  const query = useExpenseQuery(
    async (db) => {
      const [history, categories] = await Promise.all([getMonthHistory(db, month, { categoryId, search }), listActiveCategories(db)]);
      return { history, categories };
    },
    [month, categoryId, search],
  );

  const filtered = categoryId !== null || search.trim() !== '';

  return (
    <>
      <MonthSwitcher monthKey={month} onChange={setMonth} />
      <SearchField value={search} onChangeText={setSearch} />

      <LoadGate query={query}>
        {({ history, categories }) => (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityRole="radiogroup"
              contentContainerStyle={{ gap: spacing.sm }}
              style={{ flexGrow: 0, marginHorizontal: -spacing.lg }}
            >
              <View style={{ width: spacing.lg - spacing.sm }} />
              <Chip label="All" selected={categoryId === null} onPress={() => setCategoryId(null)} />
              {categories.map((c) => (
                <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
              <View style={{ width: spacing.lg - spacing.sm }} />
            </ScrollView>

            {history.count > 0 ? (
              <AppText
                muted
                accessibilityLiveRegion="polite"
                accessibilityLabel={`${history.count} entries. ${formatPaise(history.expensePaise)} spent${history.incomePaise > 0 ? `, ${formatPaise(history.incomePaise)} income` : ''}.`}
              >
                {formatPaise(history.expensePaise)} spent
                {history.incomePaise > 0 ? ` · ${formatPaise(history.incomePaise)} income` : ''} · {history.count}{' '}
                {history.count === 1 ? 'entry' : 'entries'}
              </AppText>
            ) : null}

            {history.days.length === 0 ? (
              <EmptyState
                title={filtered ? 'No matches' : 'Nothing this month'}
                message={filtered ? 'Try a different word or category.' : 'Entries you add will show up here, day by day.'}
              />
            ) : (
              history.days.map((day) => <DaySection key={day.date} day={day} onOpen={nav.editTransaction} />)
            )}
          </>
        )}
      </LoadGate>
    </>
  );
}
