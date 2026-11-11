import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { BottomSheet } from '../../components/common/BottomSheet';
import { Button } from '../../components/common/Button';
import { CalendarMonth } from '../../components/common/CalendarMonth';
import { FormError } from '../../components/common/FormError';
import { MonthSwitcher } from '../../components/common/MonthSwitcher';
import { TextField } from '../../components/common/TextField';
import { getDatabase } from '../../database/client';
import { useTheme } from '../../theme/ThemeProvider';
import { monthKeyOf, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { formatPaise, parseRupeesToPaise } from '../../utils/money';
import { formatDayMonthYear, paiseToInput } from './expenseMath';
import { DateField } from './parts';
import { createGoal, getGoalDetail, updateGoal } from './savingsService';
import { useAction } from './useExpenseData';

// Calendar content for choosing one date. Mount it only while it is shown, so it starts on the right month.
export function DatePickerPanel({ value, onPick, onCancel, onClear, clearLabel = 'No date' }) {
  const { spacing } = useTheme();
  const [monthKey, setMonthKey] = useState(monthKeyOf(value ?? toDateKey()));
  return (
    <View style={{ gap: spacing.md }}>
      <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />
      <CalendarMonth monthKey={monthKey} selectedDate={value} onSelect={onPick} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {onClear ? <Button title={clearLabel} variant="outline" onPress={onClear} style={{ flex: 1 }} /> : null}
        <Button title="Cancel" variant="soft" onPress={onCancel} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function DatePickerSheet({ visible, value, title = 'Pick a date', onPick, onClose }) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <DatePickerPanel value={value} onPick={onPick} onCancel={onClose} />
    </BottomSheet>
  );
}

// One amount (and an optional note), used for budget limits and savings contributions.
// `onSubmit(db, paise, note)` does the write; `onClear(db)` (optional) removes the thing being edited.
export function AmountSheet({
  visible,
  title,
  label = 'Amount (₹)',
  description = null,
  initialPaise = null,
  submitLabel = 'Save',
  noteLabel = null,
  onClose,
  onSubmit,
  onClear = null,
  clearLabel = 'Remove',
}) {
  const { spacing } = useTheme();
  const { busy, error, setError, run } = useAction();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setAmount(initialPaise ? paiseToInput(initialPaise) : '');
    setNote('');
    setError(null);
  }, [visible, initialPaise, setError]);

  const submit = async () => {
    const ok = await run(async (db) => {
      const paise = parseRupeesToPaise(amount);
      if (paise === null || paise <= 0) throw new ValidationError('Enter an amount like 5000 or 99.50.');
      await onSubmit(db, paise, note);
    });
    if (ok) onClose();
  };

  const clear = async () => {
    const ok = await run((db) => onClear(db));
    if (ok) onClose();
  };

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      {description ? <AppText muted>{description}</AppText> : null}
      <TextField label={label} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" autoFocus />
      {noteLabel ? <TextField label={noteLabel} value={note} onChangeText={setNote} placeholder="Optional" maxLength={200} /> : null}
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : submitLabel} onPress={submit} disabled={busy} />
      {onClear ? <Button title={clearLabel} variant="outline" onPress={clear} disabled={busy} /> : null}
    </BottomSheet>
  );
}

// Create or edit a savings goal. `goal` null means a new one.
export function GoalSheet({ visible, goal, onClose, onSaved }) {
  const { busy, error, setError, run } = useAction();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(goal?.name ?? '');
    setTarget(goal ? paiseToInput(goal.targetPaise) : '');
    setDeadline(goal?.deadline ?? null);
    setPicking(false);
    setError(null);
  }, [visible, goal, setError]);

  const submit = async () => {
    const ok = await run(async (db) => {
      const targetPaise = parseRupeesToPaise(target);
      if (targetPaise === null || targetPaise <= 0) throw new ValidationError('Enter a target like 50000.');
      const input = { name, targetPaise, deadline };
      if (goal) await updateGoal(db, goal.id, input);
      else await createGoal(db, input);
    });
    if (ok) {
      onSaved();
      onClose();
    }
  };

  // The calendar replaces the form inside the same sheet, so only one modal is ever open.
  return (
    <BottomSheet visible={visible} title={picking ? 'Pick a target date' : goal ? 'Edit goal' : 'New savings goal'} onClose={onClose}>
      {picking ? (
        <DatePickerPanel
          value={deadline}
          onPick={(key) => {
            setDeadline(key);
            setPicking(false);
          }}
          onCancel={() => setPicking(false)}
          onClear={() => {
            setDeadline(null);
            setPicking(false);
          }}
          clearLabel="No date"
        />
      ) : (
        <>
          <TextField label="What are you saving for?" value={name} onChangeText={setName} placeholder="Trip, laptop, rainy-day fund…" maxLength={60} />
          <TextField label="Target (₹)" value={target} onChangeText={setTarget} placeholder="0" keyboardType="decimal-pad" />
          <DateField label="Target date (optional)" text={deadline ? formatDayMonthYear(deadline) : 'No date'} onPress={() => setPicking(true)} />
          <FormError message={error} />
          <Button title={busy ? 'Saving…' : goal ? 'Save changes' : 'Create goal'} onPress={submit} disabled={busy} />
        </>
      )}
    </BottomSheet>
  );
}

export function ContributionsSheet({ visible, goal, onClose }) {
  const { spacing } = useTheme();
  const [detail, setDetail] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || !goal) return undefined;
    let cancelled = false;
    setDetail(null);
    setFailed(false);
    getDatabase()
      .then((db) => getGoalDetail(db, goal.id))
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [visible, goal]);

  return (
    <BottomSheet visible={visible} title={goal?.name ?? 'Savings'} onClose={onClose}>
      {failed ? <AppText muted>We couldn't load this. Your data hasn't been changed.</AppText> : null}
      {detail && detail.contributions.length === 0 ? <AppText muted>Nothing added yet. Every little bit counts.</AppText> : null}
      {detail?.contributions.map((c) => (
        <View
          key={c.id}
          accessible
          accessibilityLabel={`${formatPaise(c.amount_paise)} on ${formatDayMonthYear(c.contrib_date)}${c.note ? `, ${c.note}` : ''}`}
          style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <View style={{ flex: 1 }}>
            <AppText>{formatDayMonthYear(c.contrib_date)}</AppText>
            {c.note ? (
              <AppText variant="caption" muted numberOfLines={2}>
                {c.note}
              </AppText>
            ) : null}
          </View>
          <AppText variant="heading">{formatPaise(c.amount_paise)}</AppText>
        </View>
      ))}
      {detail && detail.contributionCount > detail.contributions.length ? (
        <AppText variant="caption" muted>
          Showing the latest {detail.contributions.length} of {detail.contributionCount}.
        </AppText>
      ) : null}
      <Button title="Close" variant="soft" onPress={onClose} />
    </BottomSheet>
  );
}
