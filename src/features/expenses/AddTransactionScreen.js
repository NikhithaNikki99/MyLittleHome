import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import { FormError } from '../../components/common/FormError';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SegmentedTabs } from '../../components/common/SegmentedTabs';
import { TextField } from '../../components/common/TextField';
import { useTheme } from '../../theme/ThemeProvider';
import { formatLongDate, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { parseRupeesToPaise } from '../../utils/money';
import { addTransaction, deleteTransaction, getTransaction, listActiveCategories, updateTransaction } from './expenseService';
import { paiseToInput } from './expenseMath';
import { DateField, firstParam, LoadGate } from './parts';
import { DatePickerSheet } from './sheets';
import { useAction, useExpenseQuery } from './useExpenseData';

const KINDS = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
];

// Add a new entry (optionally with a category preselected), or edit/delete one when `id` is given.
export default function AddTransactionScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id) ?? null;
  const presetCategory = firstParam(params.categoryId) ?? null;
  const router = useRouter();
  const { spacing } = useTheme();
  const { busy, error, run } = useAction();

  const query = useExpenseQuery(async (db) => {
    const [active, existing] = await Promise.all([listActiveCategories(db), id ? getTransaction(db, id) : null]);
    // An entry may use a category archived since; keep it selectable so the form shows the truth.
    const categories =
      existing && !active.some((c) => c.id === existing.category_id)
        ? [...active, { id: existing.category_id, name: existing.category_name, icon: existing.category_icon }]
        : active;
    return { categories, existing };
  }, [id]);

  const [kind, setKind] = useState('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(presetCategory);
  const [txnDate, setTxnDate] = useState(toDateKey());
  const [notes, setNotes] = useState('');
  const [pickingDate, setPickingDate] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Fill the form once, from the stored entry when editing. Later reloads must not overwrite what is being typed.
  const loaded = query.data;
  useEffect(() => {
    if (!loaded || seeded) return;
    const row = loaded.existing;
    if (row) {
      setKind(row.kind);
      setTitle(row.title);
      setAmount(paiseToInput(row.amount_paise));
      setCategoryId(row.category_id);
      setTxnDate(row.txn_date);
      setNotes(row.notes ?? '');
    }
    setSeeded(true);
  }, [loaded, seeded]);

  const missing = id !== null && loaded && !loaded.existing;

  const save = async () => {
    const ok = await run(async (db) => {
      const amountPaise = parseRupeesToPaise(amount);
      if (amountPaise === null || amountPaise <= 0) throw new ValidationError('Enter an amount like 250 or 99.50.');
      const input = { kind, title, amountPaise, categoryId, txnDate, notes };
      if (id) await updateTransaction(db, id, input);
      else await addTransaction(db, input);
    });
    if (ok) router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Delete this entry?', "This can't be undone.", [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await run((db) => deleteTransaction(db, id));
          if (ok) router.back();
        },
      },
    ]);

  const editing = id !== null;

  return (
    <Screen>
      <ScreenHeader title={editing ? 'Edit entry' : 'Add expense'} back />
      <LoadGate query={query}>
        {({ categories }) =>
          missing ? (
            <View style={{ gap: spacing.md }}>
              <AppText muted>This entry no longer exists.</AppText>
              <Button title="Go back" variant="soft" onPress={() => router.back()} />
            </View>
          ) : (
            <>
              <SegmentedTabs tabs={KINDS} value={kind} onChange={setKind} />

              <TextField
                label="Amount (₹)"
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="decimal-pad"
                autoFocus={!editing}
              />
              <TextField
                label="What was it for?"
                value={title}
                onChangeText={setTitle}
                placeholder={kind === 'income' ? 'Salary, gift, refund…' : 'Lunch, auto, groceries…'}
                maxLength={80}
              />

              <View style={{ gap: spacing.sm }}>
                <AppText variant="label">Category</AppText>
                <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {categories.map((c) => (
                    <Chip key={c.id} label={c.name} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
                  ))}
                </View>
              </View>

              <DateField label="Date" text={formatLongDate(txnDate)} onPress={() => setPickingDate(true)} />
              <TextField
                label="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything you'd like to remember"
                multiline
                maxLength={500}
                style={{ minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md }}
              />

              <FormError message={error} />
              <Button title={busy ? 'Saving…' : kind === 'income' ? 'Save income' : 'Save expense'} onPress={save} disabled={busy} />
              {editing ? <Button title="Delete entry" variant="outline" onPress={confirmDelete} disabled={busy} /> : null}
            </>
          )
        }
      </LoadGate>

      <DatePickerSheet
        visible={pickingDate}
        value={txnDate}
        onPick={(key) => {
          setTxnDate(key);
          setPickingDate(false);
        }}
        onClose={() => setPickingDate(false)}
      />
    </Screen>
  );
}
