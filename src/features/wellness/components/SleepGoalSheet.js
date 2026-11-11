import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { FormError } from '../../../components/common/FormError';
import { ValidationError } from '../../../utils/errors';
import { wellnessActions } from '../wellnessActions';
import { useSubmit } from '../useSubmit';
import { parseDuration, splitDuration } from '../wellnessStats';
import { DurationFields } from './DurationFields';

export function SleepGoalSheet({ visible, goalMinutes, onClose, onSaved }) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const { busy, error, setError, run } = useSubmit(onSaved);

  useEffect(() => {
    if (!visible) return;
    const parts = splitDuration(goalMinutes);
    setHours(String(parts.hours));
    setMinutes(String(parts.minutes));
    setError(null);
  }, [visible, goalMinutes, setError]);

  const save = () =>
    run(async () => {
      const total = parseDuration(hours, minutes);
      if (total === null) throw new ValidationError('Enter a goal between 2 and 16 hours.');
      await wellnessActions.setSleepGoal(total);
    });

  return (
    <BottomSheet visible={visible} title="Sleep goal" onClose={onClose}>
      <DurationFields hours={hours} minutes={minutes} onHours={setHours} onMinutes={setMinutes} />
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Save goal'} onPress={save} disabled={busy} />
    </BottomSheet>
  );
}
