import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Chip } from '../../../components/common/Chip';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { useTheme } from '../../../theme/ThemeProvider';
import { dashboardActions } from '../dashboardActions';
import { useSheetSubmit } from './useSheetSubmit';

const PRIORITIES = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Low' },
];

export function AddTaskSheet({ visible, onClose }) {
  const { spacing } = useTheme();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(2);
  const { busy, error, setError, run } = useSheetSubmit(onClose);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setPriority(2);
      setError(null);
    }
  }, [visible, setError]);

  const submit = () => run(() => dashboardActions.addTask({ title, priority }));

  return (
    <BottomSheet visible={visible} title="Add to-do" onClose={onClose}>
      <TextField label="What needs doing today?" value={title} onChangeText={setTitle} placeholder="Call the bank" />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">Priority</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {PRIORITIES.map((p) => (
            <Chip key={p.value} label={p.label} selected={p.value === priority} onPress={() => setPriority(p.value)} />
          ))}
        </View>
      </View>
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Save to-do'} onPress={submit} disabled={busy} />
    </BottomSheet>
  );
}
