import { Pencil, PenLine } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useTheme } from '../../theme/ThemeProvider';
import { formatMonthKey } from '../../utils/dates';
import { REFLECTION_FIELDS } from './reflectionOptions';

// Shows the user's own reflection for the month, or a gentle invitation to write one.
// `canWrite` is false for a month that has not begun yet.
export function ReflectionCard({ monthKey, reflection, canWrite, onEdit }) {
  const { colors, spacing } = useTheme();
  const month = formatMonthKey(monthKey);

  if (!reflection) {
    if (!canWrite) return null;
    return (
      <Card tone="accentLavender" style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <PenLine color={colors.primary} size={18} />
          <AppText variant="heading" accessibilityRole="header">
            Your reflection
          </AppText>
        </View>
        <AppText>A few quiet words about {month}, if you feel like it. There are no right answers and nothing is scored.</AppText>
        <Button title={`Reflect on ${month}`} onPress={onEdit} />
      </Card>
    );
  }

  const filled = REFLECTION_FIELDS.filter((f) => reflection[f.key]);
  return (
    <Card tone="accentLavender" style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <PenLine color={colors.primary} size={18} />
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          Your reflection
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit your reflection for ${month}`}
          onPress={onEdit}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Pencil color={colors.text} size={20} />
        </Pressable>
      </View>
      {filled.map((f) => (
        <View key={f.key} style={{ gap: 2 }} accessible accessibilityLabel={`${f.label}. ${reflection[f.key]}`}>
          <AppText variant="label" muted>
            {f.label}
          </AppText>
          <AppText>{reflection[f.key]}</AppText>
        </View>
      ))}
    </Card>
  );
}
