import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Chip } from '../../../components/common/Chip';
import { FormError } from '../../../components/common/FormError';
import { useTheme } from '../../../theme/ThemeProvider';
import { ValidationError } from '../../../utils/errors';
import { toDateKey } from '../../../utils/dates';
import { wellnessActions } from '../wellnessActions';
import { confirmDelete } from '../confirm';
import { useSubmit } from '../useSubmit';
import { parseDuration, splitDuration } from '../wellnessStats';
import { DayStepper } from './DayStepper';
import { DurationFields } from './DurationFields';

const QUALITIES = [1, 2, 3, 4, 5];

// Log a night (keyed by the day you woke up). `entry` ({ date, minutes, quality, note }) edits one.
export function SleepSheet({ visible, entry, onClose, onSaved }) {
  const { spacing } = useTheme();
  const [date, setDate] = useState(toDateKey());
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [quality, setQuality] = useState(null);
  const { busy, error, setError, run } = useSubmit(onSaved);
  const editing = Boolean(entry);

  useEffect(() => {
    if (!visible) return;
    if (entry) {
      const parts = splitDuration(entry.minutes);
      setHours(String(parts.hours));
      setMinutes(String(parts.minutes));
      setDate(entry.date);
      setQuality(entry.quality);
    } else {
      setHours('');
      setMinutes('');
      setDate(toDateKey());
      setQuality(null);
    }
    setError(null);
  }, [visible, entry, setError]);

  const save = () =>
    run(async () => {
      const total = parseDuration(hours, minutes);
      if (total === null) throw new ValidationError('Enter how long you slept, like 7 hours 30 minutes.');
      await wellnessActions.saveSleep({ minutes: total, quality, logDate: date, note: entry?.note ?? null });
    });

  const remove = () =>
    confirmDelete(
      { title: 'Delete this night?', message: 'This sleep record will be removed.' },
      () => run(() => wellnessActions.removeSleep(entry.date)),
    );

  return (
    <BottomSheet visible={visible} title={editing ? 'Edit sleep' : 'Log sleep'} onClose={onClose}>
      {editing ? null : <DayStepper label="Woke up on" value={date} onChange={setDate} />}
      <DurationFields hours={hours} minutes={minutes} onHours={setHours} onMinutes={setMinutes} />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">How rested do you feel? (optional)</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {QUALITIES.map((q) => (
            <View key={q} style={{ flex: 1 }}>
              <Chip
                label={String(q)}
                selected={quality === q}
                accessibilityLabel={`Rested ${q} of 5`}
                onPress={() => setQuality(quality === q ? null : q)}
              />
            </View>
          ))}
        </View>
        <AppText variant="caption" muted>
          1 is very tired, 5 is fully rested. Tap again to clear.
        </AppText>
      </View>
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Save sleep'} onPress={save} disabled={busy} />
      {editing ? <Button title="Delete night" variant="outline" onPress={remove} disabled={busy} /> : null}
    </BottomSheet>
  );
}
