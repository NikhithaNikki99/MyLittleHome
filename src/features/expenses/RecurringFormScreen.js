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
import { listActiveCategories } from './expenseService';
import { paiseToInput } from './expenseMath';
import { DateField, firstParam, LoadGate } from './parts';
import { FREQUENCIES, scheduleLabel } from './recurrence';
import { createRecurring, deleteRecurring, getRecurring, updateRecurring } from './recurringService';
import { DatePickerSheet } from './sheets';
import { useAction, useExpenseQuery } from './useExpenseData';

// Add a subscription, or edit/delete one when `id` is given. Frequency and start date are fixed once created.
export default function RecurringFormScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id) ?? null;
  const router = useRouter();
  const { spacing } = useTheme();
  const { busy, error, run } = useAction();

  const query = useExpenseQuery(async (db) => {
    const [active, existing] = await Promise.all([listActiveCategories(db), id ? getRecurring(db, id) : null]);
    const categories =
      existing && !active.some((c) => c.id === existing.categoryId)
        ? [...active, { id: existing.categoryId, name: existing.categoryName, icon: existing.categoryIcon }]
        : active;
    return { categories, existing };
  }, [id]);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState(toDateKey());
  const [endDate, setEndDate] = useState(null);
  const [notes, setNotes] = useState('');
  const [picking, setPicking] = useState(null); // 'start' | 'end' | null
  const [seeded, setSeeded] = useState(false);

  const loaded = query.data;
  useEffect(() => {
    if (!loaded || seeded) return;
    const row = loaded.existing;
    if (row) {
      setTitle(row.title);
      setAmount(paiseToInput(row.amountPaise));
      setCategoryId(row.categoryId);
      setFrequency(row.frequency);
      setStartDate(row.startDate);
      setEndDate(row.endDate);
      setNotes(row.notes ?? '');
    }
    setSeeded(true);
  }, [loaded, seeded]);

  const editing = id !== null;
  const missing = editing && loaded && !loaded.existing;

  const save = async () => {
    const ok = await run(async (db) => {
      const amountPaise = parseRupeesToPaise(amount);
      if (amountPaise === null || amountPaise <= 0) throw new ValidationError('Enter an amount like 199 or 99.50.');
      const input = { title, amountPaise, categoryId, frequency, startDate, endDate, notes };
      if (editing) await updateRecurring(db, id, input);
      else await createRecurring(db, input);
    });
    if (ok) router.back();
  };

  const confirmDelete = () =>
    Alert.alert('Delete this subscription?', 'Expenses it already added stay in your history. No new ones will be added.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ok = await run((db) => deleteRecurring(db, id));
          if (ok) router.back();
        },
      },
    ]);

  return (
    <Screen>
      <ScreenHeader title={editing ? 'Edit subscription' : 'Add subscription'} back />
      <LoadGate query={query}>
        {({ categories }) =>
          missing ? (
            <View style={{ gap: spacing.md }}>
              <AppText muted>This subscription no longer exists.</AppText>
              <Button title="Go back" variant="soft" onPress={() => router.back()} />
            </View>
          ) : (
            <>
              <TextField label="Name" value={title} onChangeText={setTitle} placeholder="Rent, music plan, gym…" maxLength={80} autoFocus={!editing} />
              <TextField label="Amount each time (₹)" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" />

              <View style={{ gap: spacing.sm }}>
                <AppText variant="label">How often</AppText>
                {editing ? (
                  <AppText muted>{scheduleLabel(frequency, startDate)}. The schedule can not be changed after it is created. Delete it and add a new one to change it.</AppText>
                ) : (
                  <SegmentedTabs tabs={FREQUENCIES} value={frequency} onChange={setFrequency} />
                )}
              </View>

              <View style={{ gap: spacing.sm }}>
                <AppText variant="label">Category</AppText>
                <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {categories.map((c) => (
                    <Chip key={c.id} label={c.name} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
                  ))}
                </View>
              </View>

              {editing ? null : (
                <DateField label="First charge on" text={formatLongDate(startDate)} onPress={() => setPicking('start')} />
              )}
              <DateField label="Ends on (optional)" text={endDate ? formatLongDate(endDate) : 'No end date'} onPress={() => setPicking('end')} />
              {endDate ? <Button title="Remove end date" variant="soft" onPress={() => setEndDate(null)} /> : null}
              {!editing && startDate <= toDateKey() ? (
                <AppText variant="caption" muted>
                  Charges from this date up to today are added to your expenses when you save.
                </AppText>
              ) : null}

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
              <Button title={busy ? 'Saving…' : editing ? 'Save changes' : 'Add subscription'} onPress={save} disabled={busy} />
              {editing ? <Button title="Delete subscription" variant="outline" onPress={confirmDelete} disabled={busy} /> : null}
            </>
          )
        }
      </LoadGate>

      <DatePickerSheet
        visible={picking !== null}
        value={picking === 'end' ? endDate ?? startDate : startDate}
        title={picking === 'end' ? 'Last charge on or before' : 'First charge on'}
        onPick={(key) => {
          if (picking === 'end') setEndDate(key);
          else setStartDate(key);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </Screen>
  );
}
