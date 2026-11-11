import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { BottomSheet } from '../../components/common/BottomSheet';
import { Button } from '../../components/common/Button';
import { FormError } from '../../components/common/FormError';
import { TextField } from '../../components/common/TextField';
import { useTheme } from '../../theme/ThemeProvider';
import { formatMonthKey } from '../../utils/dates';
import { useSubmit } from '../wellness/useSubmit';
import { reflectionActions } from './reflectionActions';
import { MAX_REFLECTION_LENGTH, REFLECTION_FIELDS } from './reflectionOptions';

const blank = () => Object.fromEntries(REFLECTION_FIELDS.map((f) => [f.key, '']));

// Write or edit the reflection for `monthKey`. `reflection` is the saved one, or null for a new one.
export function ReflectionSheet({ visible, monthKey, reflection, onClose, onSaved }) {
  const { spacing } = useTheme();
  const [values, setValues] = useState(blank);
  const { busy, error, setError, run } = useSubmit(onSaved);

  useEffect(() => {
    if (!visible) return;
    setValues(reflection ? Object.fromEntries(REFLECTION_FIELDS.map((f) => [f.key, reflection[f.key] ?? ''])) : blank());
    setError(null);
  }, [visible, reflection, setError]);

  const save = () => run(() => reflectionActions.save(monthKey, values));

  const confirmDelete = () =>
    Alert.alert('Delete this reflection?', "This can't be undone.", [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(() => reflectionActions.remove(monthKey)) },
    ]);

  return (
    <BottomSheet visible={visible} title={`Reflect on ${formatMonthKey(monthKey)}`} onClose={onClose}>
      {REFLECTION_FIELDS.map((f, i) => (
        <TextField
          key={f.key}
          label={f.label}
          value={values[f.key]}
          onChangeText={(text) => setValues((current) => ({ ...current, [f.key]: text }))}
          placeholder={f.placeholder}
          multiline
          maxLength={MAX_REFLECTION_LENGTH}
          autoFocus={i === 0 && !reflection}
          style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md }}
        />
      ))}
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Save reflection'} onPress={save} disabled={busy} />
      {reflection ? <Button title="Delete reflection" variant="outline" onPress={confirmDelete} disabled={busy} /> : null}
    </BottomSheet>
  );
}
