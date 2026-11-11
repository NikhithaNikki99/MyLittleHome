import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { useSubmit } from '../useSubmit';

// One-field goal editor. `onSubmit(text)` parses, validates and saves (throw ValidationError for
// bad input). `onClear` (optional) removes the goal.
export function GoalSheet({
  visible,
  title,
  label,
  placeholder,
  keyboardType = 'number-pad',
  initialText = '',
  onSubmit,
  onClear = null,
  onClose,
  onSaved,
}) {
  const [text, setText] = useState('');
  const { busy, error, setError, run } = useSubmit(onSaved);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setError(null);
    }
  }, [visible, initialText, setError]);

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <TextField
        label={label}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoFocus
      />
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Save goal'} onPress={() => run(() => onSubmit(text))} disabled={busy || text.trim() === ''} />
      {onClear ? <Button title="Remove goal" variant="outline" onPress={() => run(onClear)} disabled={busy} /> : null}
    </BottomSheet>
  );
}
