import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Fab } from '../../components/common/Fab';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SegmentedTabs } from '../../components/common/SegmentedTabs';
import { getDatabase } from '../../database/client';
import { useTheme } from '../../theme/ThemeProvider';
import { monthKeyOf, toDateKey } from '../../utils/dates';
import { GoalSheet } from './GoalSheet';
import { GoalsTab } from './GoalsTab';
import { MonthTab } from './MonthTab';
import { TaskSheet } from './TaskSheet';
import { TodayTab } from './TodayTab';
import { WeekTab } from './WeekTab';
import { selectionForMonth } from './plannerDates';
import { getGoals } from './goalService';
import { getMonthTaskDays, getPlannerToday, getTasksForDay, getWeekOverview, toggleTask } from './taskService';
import { GENERIC_ERROR } from './usePlannerActions';

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'goals', label: 'Goals' },
];

const EMPTY_GROUPS = { earlier: [], today: [], someday: [] };

export default function PlannerScreen() {
  const { spacing } = useTheme();
  const [tab, setTab] = useState('today');
  const [loadError, setLoadError] = useState(null);

  const [groups, setGroups] = useState(EMPTY_GROUPS);
  const [weekAnchor, setWeekAnchor] = useState(toDateKey());
  const [week, setWeek] = useState([]);
  const [weekDay, setWeekDay] = useState(toDateKey());
  const [weekTasks, setWeekTasks] = useState([]);
  const [monthKey, setMonthKey] = useState(monthKeyOf(toDateKey()));
  const [monthDay, setMonthDay] = useState(toDateKey());
  const [monthMarks, setMonthMarks] = useState(new Set());
  const [monthTasks, setMonthTasks] = useState([]);
  const [goals, setGoals] = useState([]);

  const [taskSheet, setTaskSheet] = useState({ open: false, id: null, date: undefined });
  const [goalSheet, setGoalSheet] = useState({ open: false, id: null });

  // Latest values for the loader, so a reload after a write never reads stale state.
  const state = useRef({});
  state.current = { tab, weekAnchor, weekDay, monthKey, monthDay };

  // Loads only the active tab (and re-reads on tab/date change), always from SQLite.
  const load = useCallback(async () => {
    const s = state.current;
    const today = toDateKey();
    try {
      const db = await getDatabase();
      if (s.tab === 'today') {
        setGroups(await getPlannerToday(db, today));
      } else if (s.tab === 'week') {
        const [days, tasks] = await Promise.all([getWeekOverview(db, s.weekAnchor), getTasksForDay(db, s.weekDay, today)]);
        setWeek(days);
        setWeekTasks(tasks);
      } else if (s.tab === 'month') {
        const [marks, tasks] = await Promise.all([getMonthTaskDays(db, s.monthKey), getTasksForDay(db, s.monthDay, today)]);
        setMonthMarks(marks);
        setMonthTasks(tasks);
      } else {
        setGoals(await getGoals(db));
      }
      setLoadError(null);
    } catch (e) {
      setLoadError("We couldn't load your planner. Your data hasn't been changed.");
    }
  }, []);

  // Reload whenever the screen is focused, or the tab / selected dates change.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, tab, weekAnchor, weekDay, monthKey, monthDay]),
  );

  const onToggle = useCallback(
    async (id) => {
      try {
        await toggleTask(await getDatabase(), id);
      } catch (e) {
        setLoadError(GENERIC_ERROR);
      }
      await load();
    },
    [load],
  );

  const openTask = (id) => setTaskSheet({ open: true, id, date: undefined });
  const addTaskFor = (date) => setTaskSheet({ open: true, id: null, date });
  const closeTaskSheet = useCallback(() => setTaskSheet((s) => ({ ...s, open: false })), []);
  const closeGoalSheet = useCallback(() => setGoalSheet((s) => ({ ...s, open: false })), []);

  const onFab = () => {
    if (tab === 'goals') setGoalSheet({ open: true, id: null });
    else if (tab === 'week') addTaskFor(weekDay);
    else if (tab === 'month') addTaskFor(monthDay);
    else addTaskFor(toDateKey());
  };
  const fabLabel = tab === 'goals' ? 'Add goal' : 'Add to-do';

  const changeWeek = (anchor) => {
    setWeekAnchor(anchor);
    setWeekDay(anchor);
  };
  const changeMonth = (key) => {
    setMonthKey(key);
    setMonthDay(selectionForMonth(key, toDateKey()));
  };

  return (
    <Screen floating={<Fab onPress={onFab} label={fabLabel} />}>
      <ScreenHeader title="Planner" />
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      {loadError ? (
        <Card tone="accentButter" style={{ gap: spacing.sm }}>
          <AppText accessibilityLiveRegion="polite">{loadError}</AppText>
          <Button title="Try again" variant="soft" onPress={load} />
        </Card>
      ) : null}

      {tab === 'today' ? <TodayTab groups={groups} onToggle={onToggle} onEdit={openTask} /> : null}
      {tab === 'week' ? (
        <WeekTab
          anchor={weekAnchor}
          onAnchorChange={changeWeek}
          week={week}
          selectedDate={weekDay}
          onSelectDate={setWeekDay}
          tasks={weekTasks}
          onToggle={onToggle}
          onEdit={openTask}
        />
      ) : null}
      {tab === 'month' ? (
        <MonthTab
          monthKey={monthKey}
          onMonthChange={changeMonth}
          selectedDate={monthDay}
          onSelectDate={setMonthDay}
          markedDates={monthMarks}
          tasks={monthTasks}
          onToggle={onToggle}
          onEdit={openTask}
          onAdd={() => addTaskFor(monthDay)}
        />
      ) : null}
      {tab === 'goals' ? <GoalsTab goals={goals} onOpen={(id) => setGoalSheet({ open: true, id })} /> : null}

      <View accessible={false} style={{ height: spacing.xl }} />

      <TaskSheet
        visible={taskSheet.open}
        taskId={taskSheet.id}
        defaultDate={taskSheet.date}
        onClose={closeTaskSheet}
        onSaved={load}
      />
      <GoalSheet visible={goalSheet.open} goalId={goalSheet.id} onClose={closeGoalSheet} onChanged={load} />
    </Screen>
  );
}
