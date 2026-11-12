import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { HabitsCard } from '../../components/cards/HabitsCard';
import { MoodCard } from '../../components/cards/MoodCard';
import { QuickActions } from '../../components/cards/QuickActions';
import { QuoteCard } from '../../components/cards/QuoteCard';
import { SpendingCard, WaterCard, WeightCard } from '../../components/cards/SummaryCards';
import { TasksCard } from '../../components/cards/TasksCard';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { SunsetHeader } from '../../components/illustrations/SunsetHeader';
import { sceneTopColor } from '../../components/illustrations/timeOfDay';
import { useDashboard } from '../../hooks/useDashboard';
import { useTimeOfDay } from '../../hooks/useTimeOfDay';
import { useSettingsStore } from '../../store/settingsStore';
import { FONT_DISPLAY } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { formatLongDate, greetingFor } from '../../utils/dates';
import { dashboardActions } from '../dashboard/dashboardActions';
import { AddExpenseSheet } from '../dashboard/sheets/AddExpenseSheet';
import { AddTaskSheet } from '../dashboard/sheets/AddTaskSheet';
import { AddWaterSheet } from '../dashboard/sheets/AddWaterSheet';
import { AddWeightSheet } from '../dashboard/sheets/AddWeightSheet';

const HEADER_HEIGHT = 180;

// Greeting over the sunset illustration. The name is optional and comes from Settings.
function HomeHeader({ dateKey, now }) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const name = useSettingsStore((s) => s.profileName);
  const height = HEADER_HEIGHT;

  // The artwork starts right below the status bar (Screen leaves that strip empty), so nothing is drawn under the
  // clock and icons. Only the page's top padding is cancelled, so the artwork reaches the strip.
  return (
    <View style={{ height, marginHorizontal: -spacing.lg, marginTop: -spacing.lg }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <SunsetHeader width={width} height={height} fadeTo={colors.backgroundTop} date={now} />
      </View>
      <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.sm, gap: 2 }}>
        <AppText variant="heading">{name ? `${greetingFor(now)},` : greetingFor(now)}</AppText>
        {name ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText style={{ fontFamily: FONT_DISPLAY, fontSize: 34, lineHeight: 44 }}>{name}</AppText>
            <Heart color={colors.primary} size={20} fill={colors.primary} />
          </View>
        ) : null}
        <AppText muted>{formatLongDate(dateKey)}</AppText>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { data, status, error, reload } = useDashboard();
  const now = useTimeOfDay();
  const [sheet, setSheet] = useState(null);
  const [notice, setNotice] = useState(null);
  const closeSheet = () => setSheet(null);

  // Errors from a toggle/pick are surfaced inline; the dashboard re-reads from SQLite either way.
  const act = (fn) => async (...args) => {
    setNotice(null);
    try {
      await fn(...args);
    } catch (e) {
      setNotice("Couldn't save that. Please try again.");
    }
  };

  if (!data) {
    return (
      <Screen>
        {status === 'error' ? (
          <Card style={{ gap: spacing.md }}>
            <AppText variant="heading">We couldn't load your day</AppText>
            <AppText muted>Your data hasn't been changed. {error?.message ?? ''}</AppText>
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
    <Screen statusBarColor={sceneTopColor(now)}>
      <HomeHeader dateKey={data.dateKey} now={now} />

      <QuoteCard quote={data.quote} />

      <QuickActions
        onExpense={() => setSheet('expense')}
        onDiary={() => router.push('/diary/new')}
        onWeight={() => setSheet('weight')}
        onWater={() => setSheet('water')}
      />
      {notice ? (
        <AppText muted accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}

      <MoodCard mood={data.mood} onPick={act(dashboardActions.setMood)} />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <SpendingCard spending={data.spending} />
        <WeightCard weight={data.weight} />
      </View>

      <WaterCard water={data.water} />

      <HabitsCard
        habits={data.habits}
        onToggle={act(dashboardActions.toggleHabit)}
        onAddSample={act(() =>
          dashboardActions.createHabit({ name: 'Drink a glass of water on waking', icon: 'droplets' }),
        )}
      />

      <TasksCard tasks={data.tasks} onToggle={act(dashboardActions.toggleTask)} onAdd={() => setSheet('task')} />

      <AddExpenseSheet visible={sheet === 'expense'} onClose={closeSheet} />
      <AddWeightSheet visible={sheet === 'weight'} onClose={closeSheet} />
      <AddWaterSheet visible={sheet === 'water'} onClose={closeSheet} />
      <AddTaskSheet visible={sheet === 'task'} onClose={closeSheet} />
    </Screen>
  );
}
