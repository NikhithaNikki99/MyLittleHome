import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Chip } from '../../../components/common/Chip';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { useTheme } from '../../../theme/ThemeProvider';
import { ValidationError } from '../../../utils/errors';
import { useSubmit } from '../../wellness/useSubmit';
import { habitActions } from '../habitActions';
import { HabitIcon } from '../habitIcons';
import {
  ALL_WEEKDAYS,
  HABIT_COLOR_KEYS,
  HABIT_ICON_KEYS,
  INTERVAL_RANGE,
  MAX_HABIT_NAME_LENGTH,
  MAX_HABIT_TARGET,
  SCHEDULE_TYPES,
  WEEKDAY_OPTIONS,
  WEEKLY_TARGET_RANGE,
} from '../habitOptions';

const WEEKLY_CHOICES = Array.from({ length: WEEKLY_TARGET_RANGE.max }, (_, i) => i + WEEKLY_TARGET_RANGE.min);
const WHOLE_NUMBER = /^\d{1,3}$/;

const COLOR_NAMES = {
  accentSage: 'Sage',
  accentPink: 'Pink',
  accentLavender: 'Lavender',
  accentButter: 'Butter',
  accentBlue: 'Blue',
};

// Create a habit, or edit `habit` (from the overview) when given.
export function HabitSheet({ visible, habit, onClose, onSaved }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('sprout');
  const [color, setColor] = useState('accentSage');
  const [scheduleType, setScheduleType] = useState('weekdays');
  const [weekdays, setWeekdays] = useState(ALL_WEEKDAYS);
  const [weeklyTarget, setWeeklyTarget] = useState(3);
  const [interval, setIntervalText] = useState('2');
  const [monthDay, setMonthDay] = useState('1');
  const [target, setTarget] = useState('1');
  const { busy, error, setError, run } = useSubmit(onSaved);
  const editing = Boolean(habit);

  useEffect(() => {
    if (!visible) return;
    setName(habit?.name ?? '');
    setIcon(habit?.icon ?? 'sprout');
    setColor(habit?.color ?? 'accentSage');
    setScheduleType(habit?.scheduleType ?? 'weekdays');
    setWeekdays(habit?.weekdays?.length ? habit.weekdays : ALL_WEEKDAYS);
    setWeeklyTarget(habit?.weeklyTarget ?? 3);
    setIntervalText(String(habit?.intervalDays ?? 2));
    setMonthDay(String(habit?.monthDay ?? 1));
    setTarget(String(habit?.targetCount ?? 1));
    setError(null);
  }, [visible, habit, setError]);

  const toggleDay = (day) =>
    setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));

  const save = () =>
    run(async () => {
      const t = target.trim();
      if (!WHOLE_NUMBER.test(t)) throw new ValidationError(`Target must be a whole number from 1 to ${MAX_HABIT_TARGET}.`);
      const input = { name, icon, color, targetCount: Number(t), scheduleType };
      if (scheduleType === 'weekdays') input.weekdays = weekdays;
      if (scheduleType === 'weekly_count') input.weeklyTarget = weeklyTarget;
      if (scheduleType === 'interval') {
        if (!WHOLE_NUMBER.test(interval.trim())) {
          throw new ValidationError(`Choose between every ${INTERVAL_RANGE.min} and every ${INTERVAL_RANGE.max} days.`);
        }
        input.intervalDays = Number(interval.trim());
      }
      if (scheduleType === 'monthly_day') {
        if (!WHOLE_NUMBER.test(monthDay.trim())) throw new ValidationError('Choose a day of the month from 1 to 31.');
        input.monthDay = Number(monthDay.trim());
      }
      if (editing) await habitActions.update(habit.id, input);
      else await habitActions.create(input);
    });

  return (
    <BottomSheet visible={visible} title={editing ? 'Edit habit' : 'New habit'} onClose={onClose}>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Drink a glass of water on waking"
        maxLength={MAX_HABIT_NAME_LENGTH}
        autoFocus={!editing}
      />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">How often</AppText>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {SCHEDULE_TYPES.map((t) => (
            <Chip key={t.key} label={t.label} selected={scheduleType === t.key} onPress={() => setScheduleType(t.key)} />
          ))}
        </View>
      </View>

      {scheduleType === 'weekdays' ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">Days</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {WEEKDAY_OPTIONS.map((d) => {
              const selected = weekdays.includes(d.value);
              return (
                <Pressable
                  key={d.value}
                  accessibilityRole="checkbox"
                  accessibilityLabel={d.label}
                  accessibilityState={{ checked: selected }}
                  onPress={() => toggleDay(d.value)}
                  style={{
                    flex: 1,
                    minHeight: touchTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radii.pill,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primarySoft : colors.surface,
                  }}
                >
                  <AppText variant="label">{d.short}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {scheduleType === 'weekly_count' ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">Days per week</AppText>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {WEEKLY_CHOICES.map((n) => (
              <Chip
                key={n}
                label={String(n)}
                accessibilityLabel={n === 1 ? 'Once a week' : `${n} days a week`}
                selected={weeklyTarget === n}
                onPress={() => setWeeklyTarget(n)}
              />
            ))}
          </View>
          <AppText variant="caption" muted>
            Any days you like, Monday to Sunday. It stays on Today until the week's goal is met.
          </AppText>
        </View>
      ) : null}

      {scheduleType === 'interval' ? (
        <View style={{ gap: spacing.xs }}>
          <TextField
            label="Repeat every (days)"
            value={interval}
            onChangeText={setIntervalText}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="2"
          />
          <AppText variant="caption" muted>
            Counted from the day the habit started. It stays on Today until you do it, so a late day still counts.
          </AppText>
        </View>
      ) : null}

      {scheduleType === 'monthly_day' ? (
        <View style={{ gap: spacing.xs }}>
          <TextField
            label="Day of the month"
            value={monthDay}
            onChangeText={setMonthDay}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="1"
          />
          <AppText variant="caption" muted>
            In shorter months it falls on the last day. It stays on Today until you do it.
          </AppText>
        </View>
      ) : null}

      <TextField
        label="Times per day"
        value={target}
        onChangeText={setTarget}
        keyboardType="number-pad"
        maxLength={3}
        placeholder="1"
      />

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">Colour</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {HABIT_COLOR_KEYS.map((key) => {
            const selected = color === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={COLOR_NAMES[key]}
                accessibilityState={{ selected }}
                onPress={() => setColor(key)}
                style={{
                  width: touchTarget,
                  height: touchTarget,
                  borderRadius: touchTarget / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors[key],
                  borderWidth: 2,
                  borderColor: selected ? colors.primary : colors.border,
                }}
              >
                {selected ? <Check color={colors.text} size={20} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">Icon</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {HABIT_ICON_KEYS.map((key) => {
            const selected = icon === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={`${key.replace('-', ' ')} icon`}
                accessibilityState={{ selected }}
                onPress={() => setIcon(key)}
                style={{
                  width: touchTarget,
                  height: touchTarget,
                  borderRadius: radii.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                }}
              >
                <HabitIcon name={key} color={colors.text} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <FormError message={error} />
      <Button title={busy ? 'Saving…' : editing ? 'Save changes' : 'Create habit'} onPress={save} disabled={busy || name.trim() === ''} />
    </BottomSheet>
  );
}

