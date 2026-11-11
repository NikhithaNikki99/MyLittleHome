import { useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ProgressBar } from '../../components/common/ProgressBar';
import { useTheme } from '../../theme/ThemeProvider';
import { formatShortDate } from '../../utils/dates';
import { formatPaise } from '../../utils/money';
import { budgetStatusText } from './expenseMath';
import { getCategoryStyle } from './categoryStyle';

export const ADD_ROUTE = '/trackers/expenses/add';

export function useExpenseNavigation() {
  const router = useRouter();
  return {
    addExpense: (params = {}) => router.push({ pathname: ADD_ROUTE, params }),
    editTransaction: (id) => router.push({ pathname: ADD_ROUTE, params: { id } }),
    openBreakdown: () => router.push('/trackers/expenses/breakdown'),
    openSubscriptions: () => router.push('/trackers/expenses/subscriptions'),
    addSubscription: () => router.push('/trackers/expenses/recurring'),
    editSubscription: (id) => router.push({ pathname: '/trackers/expenses/recurring', params: { id } }),
  };
}

// First value of an Expo Router search param (they can arrive as arrays).
export function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function CategoryBadge({ categoryId, icon, size = 44 }) {
  const { colors } = useTheme();
  const { Icon, tone } = getCategoryStyle(categoryId, icon);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors[tone] }}
    >
      <Icon color={colors.text} size={Math.round(size * 0.5)} />
    </View>
  );
}

export function IconButton({ Icon, label, onPress, color }) {
  const { colors, touchTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: touchTarget,
        height: touchTarget,
        borderRadius: touchTarget / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceMuted,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon color={color ?? colors.text} size={20} />
    </Pressable>
  );
}

export function TransactionRow({ item, showDate = true, onPress }) {
  const { colors, spacing, radii } = useTheme();
  const income = item.kind === 'income';
  const money = formatPaise(item.amount_paise);
  const label = `${item.title}, ${item.category_name}, ${income ? 'income' : 'expense'} ${money}, ${formatShortDate(item.txn_date)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens this entry to edit"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radii.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <CategoryBadge categoryId={item.category_id} icon={item.category_icon} />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1}>{item.title}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {showDate ? `${formatShortDate(item.txn_date)} · ` : ''}
          {item.category_name}
        </AppText>
      </View>
      <AppText variant="heading" color={income ? colors.success : colors.text}>
        {income ? '+' : ''}
        {money}
      </AppText>
    </Pressable>
  );
}

// A read-only date field styled like TextField that opens a picker when pressed.
export function DateField({ label, text, onPress }) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}. Change`}
        onPress={onPress}
        style={{
          minHeight: theme.touchTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Calendar color={colors.primary} size={20} />
        <AppText>{text}</AppText>
      </Pressable>
    </View>
  );
}

// Shows the loaded data via `children(data)`, a spinner on first load, or a retry card if the first load failed.
// Once data exists, a failed reload keeps the old data on screen.
export function LoadGate({ query, children }) {
  const { colors, spacing } = useTheme();
  const { data, error, reload } = query;
  if (data) return children(data);
  if (error) {
    return (
      <Card style={{ gap: spacing.md }}>
        <AppText variant="heading">We couldn't load this</AppText>
        <AppText muted>Your data hasn't been changed.</AppText>
        <Button title="Try again" onPress={reload} />
      </Card>
    );
  }
  return (
    <View style={{ paddingTop: spacing.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
    </View>
  );
}

// "This Month" card: spent so far, against the overall budget when there is one.
export function BudgetSummaryCard({ overview, title = 'This Month', actionLabel, onAction }) {
  const { colors, spacing } = useTheme();
  const { overall, spentPaise } = overview;
  const spent = formatPaise(spentPaise);
  const status = overall ? budgetStatusText(overall) : '';
  const label = overall
    ? `${title}: spent ${spent} of ${formatPaise(overall.limitPaise)}. ${status}`
    : `${title}: spent ${spent}. No budget set.`;

  return (
    <Card style={{ gap: spacing.sm }}>
      <View accessible accessibilityLabel={label} style={{ gap: spacing.sm }}>
        <AppText variant="label" muted>
          {title}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.sm }}>
          <AppText variant="display">{spent}</AppText>
          {overall ? (
            <AppText variant="heading" muted>
              of {formatPaise(overall.limitPaise)}
            </AppText>
          ) : (
            <AppText variant="body" muted>
              spent so far
            </AppText>
          )}
        </View>
        {overall ? (
          <>
            <ProgressBar progress={overall.ratio} color={overall.isAbove ? colors.secondary : colors.primary} height={12} />
            <AppText variant="caption" muted>
              {status}
            </AppText>
          </>
        ) : (
          <AppText variant="caption" muted>
            Set a monthly budget if you'd like a gentle guide. It's optional.
          </AppText>
        )}
      </View>
      {onAction ? <Button title={actionLabel} variant="soft" onPress={onAction} /> : null}
    </Card>
  );
}
