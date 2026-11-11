import { ChevronRight, Repeat } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { formatShortDate } from '../../utils/dates';
import { formatPaise } from '../../utils/money';

// Overview entry point to the subscriptions list: what repeats, what it comes to per month, and what is next.
export function SubscriptionsCard({ summary, onPress }) {
  const { colors, spacing } = useTheme();
  const { count, monthlyTotalPaise, next } = summary;

  const headline = count === 0 ? 'Nothing repeating yet' : `About ${formatPaise(monthlyTotalPaise)} a month`;
  const detail =
    count === 0
      ? 'Add rent, a streaming plan or any bill that comes back regularly.'
      : `${count} ${count === 1 ? 'subscription' : 'subscriptions'}${next ? ` · next: ${next.title} on ${formatShortDate(next.dueDate)}` : ''}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Subscriptions and recurring expenses. ${headline}. ${detail}`}
      accessibilityHint="Opens your subscriptions"
      onPress={onPress}
    >
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Repeat color={colors.primary} size={24} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">Subscriptions</AppText>
          <AppText>{headline}</AppText>
          <AppText variant="caption" muted numberOfLines={2}>
            {detail}
          </AppText>
        </View>
        <ChevronRight color={colors.textMuted} size={20} />
      </Card>
    </Pressable>
  );
}
