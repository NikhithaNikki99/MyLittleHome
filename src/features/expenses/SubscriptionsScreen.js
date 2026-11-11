import { Pause, Play, Repeat } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Fab } from '../../components/common/Fab';
import { FormError } from '../../components/common/FormError';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme } from '../../theme/ThemeProvider';
import { formatShortDate } from '../../utils/dates';
import { formatPaise } from '../../utils/money';
import { CategoryBadge, IconButton, LoadGate, useExpenseNavigation } from './parts';
import { scheduleLabel } from './recurrence';
import { listSubscriptions, postDueRecurring, setRecurringPaused, summarizeSubscriptions } from './recurringService';
import { useAction, useExpenseQuery } from './useExpenseData';

function statusText(item) {
  if (item.status === 'paused') return 'Paused';
  if (item.status === 'ended') return `Ended ${formatShortDate(item.endDate)}`;
  return `Next: ${formatShortDate(item.nextDueDate)}`;
}

function SubscriptionRow({ item, onOpen, onTogglePause }) {
  const { colors, spacing, radii } = useTheme();
  const canToggle = item.status !== 'ended';
  const label = `${item.title}, ${formatPaise(item.amountPaise)}, ${scheduleLabel(item.frequency, item.startDate)}, ${statusText(item)}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: item.status === 'active' ? 1 : 0.7 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens this subscription to edit"
        onPress={onOpen}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderRadius: radii.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <CategoryBadge categoryId={item.categoryId} icon={item.categoryIcon} />
        <View style={{ flex: 1 }}>
          <AppText numberOfLines={1}>{item.title}</AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {scheduleLabel(item.frequency, item.startDate)}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {statusText(item)}
          </AppText>
        </View>
        <AppText variant="heading" color={item.status === 'active' ? colors.text : colors.textMuted}>
          {formatPaise(item.amountPaise)}
        </AppText>
      </Pressable>
      {canToggle ? (
        <IconButton
          Icon={item.isActive ? Pause : Play}
          label={item.isActive ? `Pause ${item.title}` : `Resume ${item.title}`}
          onPress={onTogglePause}
        />
      ) : null}
    </View>
  );
}

export default function SubscriptionsScreen() {
  const { colors, spacing } = useTheme();
  const nav = useExpenseNavigation();
  const { error, run } = useAction();

  const query = useExpenseQuery(async (db) => {
    await postDueRecurring(db).catch(() => {});
    const items = await listSubscriptions(db);
    return { items, summary: summarizeSubscriptions(items) };
  }, []);

  const toggle = async (item) => {
    const ok = await run((db) => setRecurringPaused(db, item.id, item.isActive));
    if (ok) query.reload();
  };

  return (
    <Screen floating={<Fab label="Add subscription" onPress={nav.addSubscription} />}>
      <ScreenHeader title="Subscriptions" back />
      <LoadGate query={query}>
        {({ items, summary }) =>
          items.length === 0 ? (
            <EmptyState
              icon={<Repeat color={colors.primary} size={40} />}
              title="Nothing repeating yet"
              message="Add rent, a streaming plan or any bill that comes back regularly. Each charge is added to your expenses on its due date."
            />
          ) : (
            <>
              <Card style={{ gap: spacing.xs }}>
                <AppText variant="label" muted>
                  Active subscriptions
                </AppText>
                <AppText variant="display">{formatPaise(summary.monthlyTotalPaise)}</AppText>
                <AppText variant="caption" muted>
                  a month on average, across {summary.count} {summary.count === 1 ? 'subscription' : 'subscriptions'}
                </AppText>
              </Card>
              <Card style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
                {items.map((item) => (
                  <SubscriptionRow
                    key={item.id}
                    item={item}
                    onOpen={() => nav.editSubscription(item.id)}
                    onTogglePause={() => toggle(item)}
                  />
                ))}
              </Card>
              <FormError message={error} />
              <AppText variant="caption" muted>
                Pausing skips the charges that would fall due while it is paused. Deleting a subscription keeps the expenses it already added.
              </AppText>
            </>
          )
        }
      </LoadGate>
    </Screen>
  );
}
