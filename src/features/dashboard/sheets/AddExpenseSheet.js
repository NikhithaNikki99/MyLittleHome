import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Chip } from '../../../components/common/Chip';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { getDatabase } from '../../../database/client';
import { useTheme } from '../../../theme/ThemeProvider';
import { ValidationError } from '../../../utils/errors';
import { parseRupeesToPaise } from '../../../utils/money';
import { listActiveCategories } from '../../expenses/expenseService';
import { dashboardActions } from '../dashboardActions';
import { useSheetSubmit } from './useSheetSubmit';

export function AddExpenseSheet({ visible, onClose }) {
  const { spacing } = useTheme();
  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const { busy, error, setError, run } = useSheetSubmit(onClose);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setAmount('');
    setCategoryId(null);
    setError(null);
    getDatabase()
      .then(listActiveCategories)
      .then(setCategories)
      .catch(() => setError("Couldn't load categories."));
  }, [visible, setError]);

  const submit = () =>
    run(async () => {
      const amountPaise = parseRupeesToPaise(amount);
      if (amountPaise === null || amountPaise <= 0) {
        throw new ValidationError('Enter an amount like 250 or 99.50.');
      }
      await dashboardActions.addExpense({ title, amountPaise, categoryId });
    });

  return (
    <BottomSheet visible={visible} title="Add expense" onClose={onClose}>
      <TextField label="What was it for?" value={title} onChangeText={setTitle} placeholder="Lunch, auto, groceries…" />
      <TextField
        label="Amount (₹)"
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
        keyboardType="decimal-pad"
      />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">Category</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>
      </View>
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Save expense'} onPress={submit} disabled={busy} />
    </BottomSheet>
  );
}
