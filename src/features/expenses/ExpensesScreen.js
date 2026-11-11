import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Fab } from '../../components/common/Fab';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SegmentedTabs } from '../../components/common/SegmentedTabs';
import { firstParam, useExpenseNavigation } from './parts';
import { BudgetTab } from './tabs/BudgetTab';
import { HistoryTab } from './tabs/HistoryTab';
import { OverviewTab } from './tabs/OverviewTab';
import { SavingsTab } from './tabs/SavingsTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'history', label: 'History' },
  { key: 'budget', label: 'Budget' },
  { key: 'savings', label: 'Savings' },
];

export default function ExpensesScreen() {
  const params = useLocalSearchParams();
  const initial = firstParam(params.tab);
  const [tab, setTab] = useState(TABS.some((t) => t.key === initial) ? initial : 'overview');
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const nav = useExpenseNavigation();

  return (
    <Screen
      floating={
        <Fab
          label={tab === 'savings' ? 'Add savings goal' : 'Add expense'}
          onPress={() => (tab === 'savings' ? setGoalSheetOpen(true) : nav.addExpense())}
        />
      }
    >
      <ScreenHeader title="Expenses" back />
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' ? <OverviewTab onOpenBudget={() => setTab('budget')} /> : null}
      {tab === 'history' ? <HistoryTab /> : null}
      {tab === 'budget' ? <BudgetTab /> : null}
      {tab === 'savings' ? <SavingsTab goalSheetOpen={goalSheetOpen} onGoalSheetClose={() => setGoalSheetOpen(false)} /> : null}
    </Screen>
  );
}
