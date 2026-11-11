import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { BottomSheet } from '../../components/common/BottomSheet';
import { Button } from '../../components/common/Button';
import { FormError } from '../../components/common/FormError';
import { ProgressBar } from '../../components/common/ProgressBar';
import { TextField } from '../../components/common/TextField';
import { getDatabase } from '../../database/client';
import { useTheme } from '../../theme/ThemeProvider';
import { DatePickerField } from './DatePickerField';
import {
  addGoal,
  addMilestone,
  deleteGoal,
  deleteMilestone,
  getGoalDetail,
  toggleGoalComplete,
  toggleMilestone,
  updateGoal,
} from './goalService';
import { useWrite } from './usePlannerActions';

function MilestoneRow({ milestone, onToggle, onDelete }) {
  const { colors, spacing, touchTarget } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: touchTarget }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: milestone.done }}
        accessibilityLabel={milestone.title}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onToggle(milestone.id);
        }}
        style={{ flex: 1, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 2,
            borderColor: milestone.done ? colors.success : colors.border,
            backgroundColor: milestone.done ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {milestone.done ? <Check color={colors.onPrimary} size={16} strokeWidth={3} /> : null}
        </View>
        <AppText
          style={{ flex: 1, textDecorationLine: milestone.done ? 'line-through' : 'none', opacity: milestone.done ? 0.6 : 1 }}
        >
          {milestone.title}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove milestone ${milestone.title}`}
        onPress={() => onDelete(milestone.id)}
        style={{ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <X color={colors.textMuted} size={18} />
      </Pressable>
    </View>
  );
}

// Add (goalId null) or edit a goal. Milestones are managed here once the goal exists.
export function GoalSheet({ visible, goalId, onClose, onChanged }) {
  const { colors, spacing } = useTheme();
  const [currentId, setCurrentId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [targetDate, setTargetDate] = useState(null);
  const [newMilestone, setNewMilestone] = useState('');
  const { busy, error, setError, run } = useWrite();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const reload = async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const d = await getGoalDetail(await getDatabase(), id);
    if (!d) {
      onCloseRef.current();
      return;
    }
    setDetail(d);
  };

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setError(null);
    setCurrentId(goalId ?? null);
    setNewMilestone('');
    setDetail(null);
    if (!goalId) {
      setTitle('');
      setNotes('');
      setTargetDate(null);
      return undefined;
    }
    (async () => {
      try {
        const d = await getGoalDetail(await getDatabase(), goalId);
        if (cancelled) return;
        if (!d) {
          onCloseRef.current();
          return;
        }
        setDetail(d);
        setTitle(d.title);
        setNotes(d.description ?? '');
        setTargetDate(d.targetDate);
      } catch (e) {
        if (!cancelled) setError("Couldn't load that goal. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, goalId, setError]);

  const saveGoal = async () => {
    const { ok, result } = await run(async (db) => {
      if (currentId) {
        await updateGoal(db, currentId, { title, description: notes, targetDate });
        return currentId;
      }
      return addGoal(db, { title, description: notes, targetDate });
    });
    if (!ok) return;
    await onChanged?.();
    if (currentId) {
      onClose();
    } else {
      // Stay open after creating so milestones can be added straight away.
      setCurrentId(result);
      await reload(result);
    }
  };

  const mutate = async (fn, { closeAfter = false } = {}) => {
    const { ok } = await run(fn);
    if (!ok) return;
    await onChanged?.();
    if (closeAfter) onClose();
    else await reload(currentId);
  };

  const confirmDelete = () =>
    Alert.alert('Delete this goal?', 'Its milestones will be removed too.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => mutate((db) => deleteGoal(db, currentId), { closeAfter: true }) },
    ]);

  const submitMilestone = async () => {
    const text = newMilestone;
    const { ok } = await run((db) => addMilestone(db, currentId, text));
    if (!ok) return;
    setNewMilestone('');
    await onChanged?.();
    await reload(currentId);
  };

  return (
    <BottomSheet visible={visible} title={currentId ? 'Goal' : 'Add goal'} onClose={onClose}>
      <TextField label="What would you like to work towards?" value={title} onChangeText={setTitle} placeholder="Read 12 books" />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Why it matters to you"
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: spacing.md }}
      />
      <DatePickerField label="Target date" value={targetDate} onChange={setTargetDate} noneLabel="No date" showTomorrow={false} />
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : currentId ? 'Save goal' : 'Create goal'} onPress={saveGoal} disabled={busy} />

      {currentId && detail ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="heading">Milestones</AppText>
            <AppText variant="caption" muted>
              {detail.progress.label}
            </AppText>
            <ProgressBar progress={detail.progress.ratio} color={colors.success} height={10} />
          </View>
          {detail.milestones.length === 0 ? (
            <AppText muted>Break it into small steps if that helps. Totally optional.</AppText>
          ) : (
            detail.milestones.map((m) => (
              <MilestoneRow
                key={m.id}
                milestone={m}
                onToggle={(id) => mutate((db) => toggleMilestone(db, id))}
                onDelete={(id) => mutate((db) => deleteMilestone(db, id))}
              />
            ))
          )}
          <TextField
            label="Add a milestone"
            value={newMilestone}
            onChangeText={setNewMilestone}
            placeholder="Finish chapter one"
            returnKeyType="done"
            onSubmitEditing={submitMilestone}
          />
          <Button title="Add milestone" variant="soft" onPress={submitMilestone} disabled={busy} />

          <View style={{ gap: spacing.sm }}>
            <Button
              title={detail.completed ? 'Reopen goal' : 'Mark goal complete'}
              variant="soft"
              disabled={busy}
              onPress={() => mutate((db) => toggleGoalComplete(db, currentId))}
            />
            <Button title="Delete goal" variant="outline" disabled={busy} onPress={confirmDelete} />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}
