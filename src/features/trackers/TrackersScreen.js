import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronRight, HeartPulse, Sprout, Wallet } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useDashboard } from '../../hooks/useDashboard';
import { useTheme } from '../../theme/ThemeProvider';
import { formatPaise } from '../../utils/money';
import { formatMl } from '../../utils/units';

function TrackerLink({ Icon, tone, title, summary, href }) {
  const router = useRouter();
  const { colors, spacing, radii, touchTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${summary}`}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        router.push(href);
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget * 1.5 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radii.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors[tone],
          }}
        >
          <Icon color={colors.text} size={26} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="caption" muted>
            {summary}
          </AppText>
        </View>
        <ChevronRight color={colors.textMuted} size={22} />
      </Card>
    </Pressable>
  );
}

// Summaries come from the dashboard cache when it has loaded; the links work either way.
export default function TrackersScreen() {
  const { data } = useDashboard();

  const spendSummary = data
    ? `${formatPaise(data.spending.monthExpensePaise)} spent this month`
    : 'Spending, budgets and savings';
  const wellnessSummary = data
    ? `Water ${formatMl(data.water.totalMl)} of ${formatMl(data.water.goalMl)} today`
    : 'Weight, water, sleep and mood';
  const habitsSummary =
    data && data.habits.dueCount > 0
      ? `${data.habits.completedCount} of ${data.habits.dueCount} done today`
      : 'Small routines, growing a garden';

  return (
    <Screen>
      <ScreenHeader title="Track" />
      <AppText muted>Everything you like to keep an eye on, in one gentle place.</AppText>
      <TrackerLink
        Icon={Wallet}
        tone="accentPink"
        title="Expenses"
        summary={spendSummary}
        href="/trackers/expenses"
      />
      <TrackerLink
        Icon={HeartPulse}
        tone="accentBlue"
        title="Wellness"
        summary={wellnessSummary}
        href="/trackers/wellness"
      />
      <TrackerLink Icon={Sprout} tone="accentSage" title="Habits" summary={habitsSummary} href="/trackers/habits" />
    </Screen>
  );
}
