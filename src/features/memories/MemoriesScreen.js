import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { MonthSwitcher } from '../../components/common/MonthSwitcher';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SegmentedTabs } from '../../components/common/SegmentedTabs';
import { getDatabase } from '../../database/client';
import { useTheme } from '../../theme/ThemeProvider';
import { monthKeyOf, toDateKey } from '../../utils/dates';
import { getMonthRecap, getTimeline } from './memoriesService';
import { RecapView } from './RecapView';
import { ReflectionSheet } from './ReflectionSheet';
import { TimelineView } from './TimelineView';

const TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'recap', label: 'Recap' },
];

export default function MemoriesScreen() {
  const { colors, spacing } = useTheme();
  const [tab, setTab] = useState('timeline');
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(toDateKey()));
  const [timeline, setTimeline] = useState(null);
  const [recap, setRecap] = useState(null);
  const [error, setError] = useState(null);
  const [reflecting, setReflecting] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (which, month) => {
    const id = ++requestId.current;
    setError(null);
    try {
      const db = await getDatabase();
      if (which === 'timeline') {
        const result = await getTimeline(db, toDateKey());
        if (id === requestId.current) setTimeline(result);
      } else {
        const result = await getMonthRecap(db, month);
        if (id === requestId.current) setRecap(result);
      }
    } catch {
      if (id === requestId.current) setError("Couldn't load your memories.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(tab, monthKey);
    }, [load, tab, monthKey]),
  );

  const changeMonth = (next) => {
    setRecap(null);
    setMonthKey(next);
  };

  const content = tab === 'timeline' ? timeline : recap?.monthKey === monthKey ? recap : null;

  return (
    <Screen>
      <ScreenHeader title="Memories" back />
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'recap' ? <MonthSwitcher monthKey={monthKey} onChange={changeMonth} /> : null}

      {error ? (
        <Card style={{ gap: spacing.md }}>
          <AppText>{error}</AppText>
          <Button title="Try again" onPress={() => load(tab, monthKey)} />
        </Card>
      ) : content === null ? (
        <View style={{ paddingTop: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
        </View>
      ) : tab === 'timeline' ? (
        <TimelineView timeline={content} />
      ) : (
        <RecapView recap={content} canReflect={monthKey <= monthKeyOf(toDateKey())} onEditReflection={() => setReflecting(true)} />
      )}

      <ReflectionSheet
        visible={reflecting}
        monthKey={monthKey}
        reflection={recap?.monthKey === monthKey ? recap.reflection : null}
        onClose={() => setReflecting(false)}
        onSaved={() => {
          setReflecting(false);
          load('recap', monthKey);
        }}
      />
    </Screen>
  );
}
