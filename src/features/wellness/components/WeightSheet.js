import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { ValidationError } from '../../../utils/errors';
import { toDateKey } from '../../../utils/dates';
import { parseKg } from '../../../utils/units';
import { wellnessActions } from '../wellnessActions';
import { confirmDelete } from '../confirm';
import { useSubmit } from '../useSubmit';
import { DayStepper } from './DayStepper';

// Add a weight, or edit/delete an existing entry when `entry` ({ id, date, kg, note }) is given.
export function WeightSheet({ visible, entry, onClose, onSaved }) {
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(toDateKey());
  const [note, setNote] = useState('');
  const { busy, error, setError, run } = useSubmit(onSaved);
  const editing = Boolean(entry);

  useEffect(() => {
    if (!visible) return;
    setKg(entry ? String(entry.kg) : '');
    setDate(entry ? entry.date : toDateKey());
    setNote(entry?.note ?? '');
    setError(null);
  }, [visible, entry, setError]);

  const save = () =>
    run(async () => {
      const parsed = parseKg(kg);
      if (parsed === null) throw new ValidationError('Enter a weight like 62.5 (between 20 and 300 kg).');
      const input = { weightKg: parsed, entryDate: date, note };
      if (editing) await wellnessActions.updateWeight(entry.id, input);
      else await wellnessActions.addWeight(input);
    });

  const remove = () =>
    confirmDelete(
      { title: 'Delete this entry?', message: 'This weight entry will be removed from your history.' },
      () => run(() => wellnessActions.removeWeight(entry.id)),
    );

  return (
    <BottomSheet visible={visible} title={editing ? 'Edit weight' : 'Log weight'} onClose={onClose}>
      <TextField
        label="Weight (kg)"
        value={kg}
        onChangeText={setKg}
        placeholder="62.5"
        keyboardType="decimal-pad"
        autoFocus={!editing}
      />
      <DayStepper label="Date" value={date} onChange={setDate} />
      <TextField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Morning, after a walk…"
        maxLength={500}
      />
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : editing ? 'Save changes' : 'Save weight'} onPress={save} disabled={busy || kg.trim() === ''} />
      {editing ? <Button title="Delete entry" variant="outline" onPress={remove} disabled={busy} /> : null}
    </BottomSheet>
  );
}
