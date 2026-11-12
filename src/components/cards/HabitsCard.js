import * as Haptics from 'expo-haptics';
import {Check, Sprout, TreePalm} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../common/AppText';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

// One plant per habit due today: a sprout until it's done, a flower once complete.
// Nothing wilts or disappears when a habit is missed, so there is nothing to feel bad about.
function GardenPreview({ items }) {
  const { colors, spacing, radii } = useTheme();
  if (items.length === 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={`Garden: ${items.filter((h) => h.complete).length} of ${items.length} in bloom`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.accentSage,
      }}
    >
      {items.map((h) =>
        h.complete ? (
          <TreePalm key={h.id} color={colors.primary} size={28} />
        ) : (
          <Sprout key={h.id} color={colors.success} size={28} />
        ),
      )}
    </View>
  );
}

export function HabitsCard({ habits, onToggle, onAddSample }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  const { items, dueCount, completedCount } = habits;

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">Today's habits</AppText>
        {dueCount > 0 ? (
          <AppText variant="label" muted>
            {completedCount} of {dueCount}
          </AppText>
        ) : null}
      </View>

      {dueCount === 0 ? (
        <View style={{ gap: spacing.md }}>
          <AppText muted>No habits due today. Create one to start growing your garden.</AppText>
          {onAddSample ? <Button title="Add a starter habit" variant="soft" onPress={onAddSample} /> : null}
        </View>
      ) : (
        <>
          <GardenPreview items={items} />
          {items.map((h) => (
            <Pressable
              key={h.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: h.complete }}
              accessibilityLabel={h.targetCount > 1 ? `${h.name}, ${h.doneCount} of ${h.targetCount}` : h.name}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onToggle(h.id);
              }}
              style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
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
              <AppText style={{ flex: 1 }}>{h.name}</AppText>
              {h.targetCount > 1 ? (
                <AppText variant="label" muted>
                  {h.doneCount}/{h.targetCount}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </>
      )}
    </Card>
  );
}
