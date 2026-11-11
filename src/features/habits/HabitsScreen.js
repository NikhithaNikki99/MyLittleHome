import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Fab } from '../../components/common/Fab';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SegmentedTabs } from '../../components/common/SegmentedTabs';
import { useTheme } from '../../theme/ThemeProvider';
import { confirmDelete } from '../wellness/confirm';
import { useLoadOnFocus } from '../wellness/useLoadOnFocus';
import { messageFor } from '../wellness/useSubmit';
import { AllHabitsTab } from './components/AllHabitsTab';
import { GardenTab } from './components/GardenTab';
import { HabitSheet } from './components/HabitSheet';
import { TodayTab } from './components/TodayTab';
import { habitActions } from './habitActions';

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'all', label: 'All Habits' },
  { key: 'garden', label: 'Garden' },
];

export default function HabitsScreen() {
  const { colors, spacing } = useTheme();
  const { data, status, error, reload } = useLoadOnFocus(habitActions.load);
  const [tab, setTab] = useState('today');
  // undefined = closed, null = creating, object = editing
  const [editing, setEditing] = useState(undefined);
  const [notice, setNotice] = useState(null);

  const closeSheet = useCallback(() => setEditing(undefined), []);
  const saved = useCallback(() => {
    setEditing(undefined);
    reload();
  }, [reload]);

  const act = useCallback(
    async (task) => {
      setNotice(null);
      try {
        await task();
      } catch (e) {
        setNotice(messageFor(e));
      }
      await reload();
    },
    [reload],
  );

  const header = <ScreenHeader title="Habits" />;

  if (!data) {
    return (
      <Screen>
        {header}
        {status === 'error' ? (
          <Card style={{ gap: spacing.md }}>
            <AppText variant="heading">We couldn't load your habits</AppText>
            <AppText muted>Nothing has been changed. {error?.message ?? ''}</AppText>
            <Button title="Try again" onPress={reload} />
          </Card>
        ) : (
          <View style={{ paddingTop: spacing.xxxl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen floating={<Fab onPress={() => setEditing(null)} label="New habit" />}>
      {header}
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
      {notice ? (
        <AppText color={colors.danger} accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}

      {tab === 'today' ? (
        <TodayTab data={data} onAdvance={(id) => act(() => habitActions.advance(id))} onCreate={() => setEditing(null)} />
      ) : null}
      {tab === 'all' ? (
        <AllHabitsTab
          data={data}
          onCreate={() => setEditing(null)}
          onEdit={(habit) => setEditing(habit)}
          onArchive={(habit) => act(() => habitActions.archive(habit.id, !habit.archived))}
          onDelete={(habit) =>
            confirmDelete(
              {
                title: `Delete "${habit.name}"?`,
                message: 'This removes the habit and all of its history for good. To keep the history, archive it instead.',
              },
              () => act(() => habitActions.remove(habit.id)),
            )
          }
        />
      ) : null}
      {tab === 'garden' ? <GardenTab data={data} /> : null}

      <HabitSheet visible={editing !== undefined} habit={editing ?? null} onClose={closeSheet} onSaved={saved} />
    </Screen>
  );
}
