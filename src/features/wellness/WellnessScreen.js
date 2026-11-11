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
import { ValidationError } from '../../utils/errors';
import { parseKg } from '../../utils/units';
import { GoalSheet } from './components/GoalSheet';
import { OverviewTab } from './components/OverviewTab';
import { SleepGoalSheet } from './components/SleepGoalSheet';
import { SleepSheet } from './components/SleepSheet';
import { SleepTab } from './components/SleepTab';
import { WaterSheet } from './components/WaterSheet';
import { WaterTab } from './components/WaterTab';
import { WeightSheet } from './components/WeightSheet';
import { WeightTab } from './components/WeightTab';
import { confirmDelete } from './confirm';
import { messageFor } from './useSubmit';
import { useLoadOnFocus } from './useLoadOnFocus';
import { wellnessActions } from './wellnessActions';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'weight', label: 'Weight' },
  { key: 'water', label: 'Water' },
  { key: 'sleep', label: 'Sleep' },
];

const FAB_LABELS = { weight: 'Log weight', water: 'Log water', sleep: 'Log sleep' };

export default function WellnessScreen() {
  const { colors, spacing } = useTheme();
  const { data, status, error, reload } = useLoadOnFocus(wellnessActions.load);
  const [tab, setTab] = useState('overview');
  // One open sheet at a time: { name, entry? }
  const [sheet, setSheet] = useState(null);
  const [notice, setNotice] = useState(null);

  const close = useCallback(() => setSheet(null), []);
  const saved = useCallback(() => {
    setSheet(null);
    reload();
  }, [reload]);

  // Direct actions (not inside a sheet): surface errors inline instead of failing silently.
  const act = useCallback(
    async (task) => {
      setNotice(null);
      try {
        await task();
        await reload();
      } catch (e) {
        setNotice(messageFor(e));
      }
    },
    [reload],
  );

  const onFab = () => setSheet({ name: tab === 'sleep' ? 'sleep' : tab === 'water' ? 'water' : 'weight' });

  const header = <ScreenHeader title="Wellness" />;

  if (!data) {
    return (
      <Screen>
        {header}
        {status === 'error' ? (
          <Card style={{ gap: spacing.md }}>
            <AppText variant="heading">We couldn't load your wellness data</AppText>
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
    <Screen floating={tab !== 'overview' ? <Fab onPress={onFab} label={FAB_LABELS[tab]} /> : null}>
      {header}
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
      {notice ? (
        <AppText color={colors.danger} accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}

      {tab === 'overview' ? <OverviewTab data={data} /> : null}
      {tab === 'weight' ? (
        <WeightTab
          data={data}
          onAdd={() => setSheet({ name: 'weight' })}
          onEdit={(entry) => setSheet({ name: 'weight', entry })}
          onGoal={() => setSheet({ name: 'weightGoal' })}
        />
      ) : null}
      {tab === 'water' ? (
        <WaterTab
          data={data}
          onQuickAdd={(ml) => act(() => wellnessActions.addWater(ml))}
          onCustom={() => setSheet({ name: 'water' })}
          onGoal={() => setSheet({ name: 'waterGoal' })}
          onDeleteLog={(log) =>
            confirmDelete(
              { title: 'Delete this drink?', message: 'This water entry will be removed from today.' },
              () => act(() => wellnessActions.removeWaterLog(log.id)),
            )
          }
        />
      ) : null}
      {tab === 'sleep' ? (
        <SleepTab
          data={data}
          onAdd={() => setSheet({ name: 'sleep' })}
          onEdit={(entry) => setSheet({ name: 'sleep', entry })}
          onGoal={() => setSheet({ name: 'sleepGoal' })}
        />
      ) : null}

      <WeightSheet visible={sheet?.name === 'weight'} entry={sheet?.entry ?? null} onClose={close} onSaved={saved} />
      <WaterSheet visible={sheet?.name === 'water'} onClose={close} onSaved={saved} />
      <SleepSheet visible={sheet?.name === 'sleep'} entry={sheet?.entry ?? null} onClose={close} onSaved={saved} />
      <SleepGoalSheet
        visible={sheet?.name === 'sleepGoal'}
        goalMinutes={data.sleep.goalMinutes}
        onClose={close}
        onSaved={saved}
      />
      <GoalSheet
        visible={sheet?.name === 'waterGoal'}
        title="Daily water goal"
        label="Goal (ml)"
        placeholder="2000"
        initialText={String(data.water.goalMl)}
        onSubmit={async (text) => {
          const clean = text.trim();
          if (!/^\d{1,5}$/.test(clean)) throw new ValidationError('Enter whole millilitres, like 2500.');
          await wellnessActions.setWaterGoal(Number(clean));
        }}
        onClose={close}
        onSaved={saved}
      />
      <GoalSheet
        visible={sheet?.name === 'weightGoal'}
        title="Weight goal"
        label="Goal (kg), optional"
        placeholder="60"
        keyboardType="decimal-pad"
        initialText={data.weight.goalKg === null ? '' : String(data.weight.goalKg)}
        onSubmit={async (text) => {
          const kg = parseKg(text);
          if (kg === null) throw new ValidationError('Enter a goal like 60 (between 20 and 300 kg).');
          await wellnessActions.setWeightGoal(kg);
        }}
        onClear={data.weight.goalKg === null ? null : () => wellnessActions.setWeightGoal(null)}
        onClose={close}
        onSaved={saved}
      />
    </Screen>
  );
}
