import { useFocusEffect } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Card } from '../../../components/common/Card';
import { FormError } from '../../../components/common/FormError';
import { useTheme } from '../../../theme/ThemeProvider';
import { ValidationError } from '../../../utils/errors';
import { loadReminders, saveReminder } from '../reminderActions';
import { REMINDERS, defaultReminder, formatTime, nextFireDay, stepTime } from '../reminderLogic';

function StepButton({ Icon, label, onPress }) {
  const { colors, radii, touchTarget } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: touchTarget,
        height: touchTarget,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.primarySoft : colors.surfaceMuted,
      })}
    >
      <Icon color={colors.text} size={20} />
    </Pressable>
  );
}

function ReminderRow({ reminder, value, onChange }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={`${reminder.label} reminder`}
        accessibilityState={{ checked: value.enabled }}
        onPress={() => onChange({ ...value, enabled: !value.enabled })}
        style={{ minHeight: touchTarget + 8, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{reminder.label}</AppText>
          <AppText variant="caption" muted>
            {value.enabled ? `Every day at ${formatTime(value)}. Next one: ${nextFireDay(value)}.` : 'Off'}
          </AppText>
        </View>
        <View
          accessible={false}
          style={{
            width: 52,
            height: 30,
            borderRadius: radii.pill,
            padding: 3,
            backgroundColor: value.enabled ? colors.primary : colors.border,
            alignItems: value.enabled ? 'flex-end' : 'flex-start',
          }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface }} />
        </View>
      </Pressable>
      {value.enabled ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
          <StepButton
            Icon={Minus}
            label={`Earlier ${reminder.label.toLowerCase()} reminder time`}
            onPress={() => onChange({ ...value, ...stepTime(value, -1) })}
          />
          <AppText variant="title" accessibilityLiveRegion="polite" style={{ minWidth: 110, textAlign: 'center' }}>
            {formatTime(value)}
          </AppText>
          <StepButton
            Icon={Plus}
            label={`Later ${reminder.label.toLowerCase()} reminder time`}
            onPress={() => onChange({ ...value, ...stepTime(value, 1) })}
          />
        </View>
      ) : null}
    </View>
  );
}

export function RemindersSection() {
  const { spacing } = useTheme();
  const [values, setValues] = useState(() => Object.fromEntries(REMINDERS.map((r) => [r.key, defaultReminder(r.key)])));
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadReminders()
        .then(setValues)
        .catch(() => setError("Couldn't load your reminders."));
    }, []),
  );

  const change = async (key, next) => {
    setError(null);
    const previous = values[key];
    setValues((v) => ({ ...v, [key]: next }));
    try {
      await saveReminder(key, next);
    } catch (e) {
      setValues((v) => ({ ...v, [key]: previous }));
      setError(e instanceof ValidationError ? e.message : "Couldn't save that reminder. Please try again.");
    }
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="heading" accessibilityRole="header">
        Reminders
      </AppText>
      <AppText variant="caption" muted>
        Optional, gentle nudges from this phone. They are off until you turn one on, and nothing is sent
        anywhere. Android may deliver them a little late to save battery.
      </AppText>
      {REMINDERS.map((r) => (
        <ReminderRow key={r.key} reminder={r} value={values[r.key]} onChange={(next) => change(r.key, next)} />
      ))}
      <FormError message={error} />
    </Card>
  );
}
