import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { ValidationError } from '../../../utils/errors';
import { parseKg } from '../../../utils/units';
import { dashboardActions } from '../dashboardActions';
import { useSheetSubmit } from './useSheetSubmit';

export function AddWeightSheet({ visible, onClose }) {
  const [value, setValue] = useState('');
  const { busy, error, setError, run } = useSheetSubmit(onClose);

  useEffect(() => {
    if (visible) {
      setValue('');
      setError(null);
    }
  }, [visible, setError]);

  const submit = () =>
    run(async () => {
      const kg = parseKg(value);
      if (kg === null) throw new ValidationError('Enter a weight like 62.5 (between 20 and 300 kg).');
      await dashboardActions.addWeight(kg);
    });

  return (
    <BottomSheet visible={visible} title="Log weight" onClose={onClose}>
      <TextField
        label="Weight (kg)"
        value={value}
        onChangeText={setValue}
        placeholder="62.5"
        keyboardType="decimal-pad"
      />
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Save weight'} onPress={submit} disabled={busy} />
    </BottomSheet>
  );
}
