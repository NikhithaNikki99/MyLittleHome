import * as Haptics from 'expo-haptics';
import { Check, Pencil } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { useTheme } from '../../theme/ThemeProvider';

const PRIORITY_LABEL = { 1: 'High priority', 2: 'Normal priority', 3: 'Low priority' };

// Priority is shown by a small dot (colour) and spoken in the accessibility label, so it never
// relies on colour alone.
function usePriorityColor() {
  const { colors } = useTheme();
  return { 1: colors.danger, 2: colors.info, 3: colors.textMuted };
}

export function TaskRow({ task, onToggle, onEdit, note }) {
  const { colors, spacing, touchTarget } = useTheme();
  const priorityColor = usePriorityColor();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: touchTarget + 8 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={`${task.title}, ${PRIORITY_LABEL[task.priority]}${note ? `, ${note}` : ''}`}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onToggle(task.id);
        }}
        hitSlop={4}
        style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: task.done ? colors.success : colors.border,
            backgroundColor: task.done ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {task.done ? <Check color={colors.onPrimary} size={18} strokeWidth={3} /> : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${task.title}`}
        onPress={() => onEdit(task.id)}
        style={{
          flex: 1,
          minHeight: touchTarget,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingLeft: spacing.xs,
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText style={{ textDecorationLine: task.done ? 'line-through' : 'none', opacity: task.done ? 0.6 : 1 }}>
            {task.title}
          </AppText>
          {note ? (
            <AppText variant="caption" color={colors.secondary}>
              {note}
            </AppText>
          ) : null}
        </View>
        <View
          accessible={false}
          style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: priorityColor[task.priority] }}
        />
        <Pencil color={colors.textMuted} size={16} />
      </Pressable>
    </View>
  );
}
