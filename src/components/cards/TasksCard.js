import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../common/AppText';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

export function TasksCard({ tasks, onToggle, onAdd }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="heading">Today's to-dos</AppText>
      {tasks.length === 0 ? (
        <AppText muted>Nothing due today. Enjoy the space, or add something small.</AppText>
      ) : (
        tasks.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: t.done }}
            accessibilityLabel={t.overdue ? `${t.title}, overdue` : t.title}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onToggle(t.id);
            }}
            style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: t.done ? colors.success : colors.border,
                backgroundColor: t.done ? colors.success : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {t.done ? <Check color={colors.onPrimary} size={18} strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={{ textDecorationLine: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>
                {t.title}
              </AppText>
              {t.overdue ? (
                <AppText variant="caption" color={colors.secondary}>
                  Carried over from earlier
                </AppText>
              ) : null}
            </View>
          </Pressable>
        ))
      )}
      <Button title="Add a to-do" variant="soft" onPress={onAdd} />
    </Card>
  );
}
