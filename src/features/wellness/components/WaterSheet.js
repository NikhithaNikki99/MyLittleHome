import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { ValidationError } from '../../../utils/errors';
import { parseMl } from '../../../utils/units';
import { wellnessActions } from '../wellnessActions';
import { useSubmit } from '../useSubmit';

export function WaterSheet({ visible, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const { busy, error, setError, run } = useSubmit(onSaved);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setError(null);
    }
  }, [visible, setError]);

  const save = () =>
    run(async () => {
      const ml = parseMl(amount);
      if (ml === null) throw new ValidationError('Enter whole millilitres between 1 and 5000, like 330.');
      await wellnessActions.addWater(ml);
    });

  return (
    <BottomSheet visible={visible} title="Log water" onClose={onClose}>
      <TextField
        label="Amount (ml)"
        value={amount}
        onChangeText={setAmount}
        placeholder="330"
        keyboardType="number-pad"
        autoFocus
      />
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Add water'} onPress={save} disabled={busy || amount.trim() === ''} />
    </BottomSheet>
  );
}
