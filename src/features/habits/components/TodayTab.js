import * as Haptics from 'expo-haptics';
import { Check, Flame } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { ProgressRing } from '../../../components/charts/ProgressRing';
import { useTheme } from '../../../theme/ThemeProvider';
import { HabitIcon } from '../habitIcons';

function pluralDays(n) {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

export function TodayTab({ data, onAdvance, onCreate }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  const { dueToday, dueCount, completedCount, streakDays, weekPercent } = data;
  const progress = dueCount === 0 ? 0 : completedCount / dueCount;

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <ProgressRing progress={progress} size={96} strokeWidth={10} color={colors.primary}>
          <AppText variant="title" accessibilityLabel={`${completedCount} of ${dueCount} completed`}>
            {completedCount}/{dueCount}
          </AppText>
        </ProgressRing>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <AppText variant="heading">{dueCount === 0 ? 'Nothing due today' : `${completedCount}/${dueCount} Completed`}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Flame color={colors.primary} size={18} />
            <AppText accessibilityLabel={`${pluralDays(streakDays)} current streak`}>
              {pluralDays(streakDays)} current streak
            </AppText>
          </View>
          <AppText muted accessibilityLabel={`${weekPercent} percent this week`}>
            {weekPercent}% this week
          </AppText>
        </View>
      </Card>

      {dueCount === 0 ? (
        <View style={{ gap: spacing.md }}>
          <EmptyState
            title={data.habits.some((h) => !h.archived) ? 'A free day' : 'No habits yet'}
            message={
              data.habits.some((h) => !h.archived)
                ? 'None of your habits are scheduled for today.'
                : 'Start with something small. You can change it any time.'
            }
          />
          {data.habits.some((h) => !h.archived) ? null : <Button title="Create a habit" onPress={onCreate} />}
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {dueToday.map((h) => (
            <Pressable
              key={h.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: h.complete }}
              accessibilityLabel={`${h.name}${h.targetCount > 1 ? `, ${h.doneCount} of ${h.targetCount}` : ''}${h.note ? `. ${h.note}` : ''}`}
              accessibilityHint={h.targetCount > 1 ? 'Double tap to add one' : 'Double tap to toggle'}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onAdvance(h.id);
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: touchTarget + 8 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors[h.color] ?? colors.accentSage,
                  }}
                >
                  <HabitIcon name={h.icon} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText
                    style={{
                      textDecorationLine: h.complete ? 'line-through' : 'none',
                      opacity: h.complete ? 0.7 : 1,
                    }}
                  >
                    {h.name}
                  </AppText>
                  {h.note ? (
                    <AppText variant="caption" muted>
                      {h.note}
                    </AppText>
                  ) : null}
                </View>
                {h.targetCount > 1 ? (
                  <AppText variant="label" muted>
                    {h.doneCount}/{h.targetCount}
                  </AppText>
                ) : null}
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radii.sm,
                    borderWidth: 2,
                    borderColor: h.complete ? colors.success : colors.border,
                    backgroundColor: h.complete ? colors.success : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {h.complete ? <Check color={colors.onPrimary} size={18} strokeWidth={3} /> : null}
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
