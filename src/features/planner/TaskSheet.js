import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { BottomSheet } from '../../components/common/BottomSheet';
import { Button } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import { FormError } from '../../components/common/FormError';
import { TextField } from '../../components/common/TextField';
import { getDatabase } from '../../database/client';
import { useTheme } from '../../theme/ThemeProvider';
import { toDateKey } from '../../utils/dates';
import { DatePickerField } from './DatePickerField';
import {
  addTask,
  deleteTask,
  getTaskForEdit,
  rescheduleTaskToTomorrow,
  toggleTask,
  updateTask,
} from './taskService';
import { useWrite } from './usePlannerActions';

const PRIORITIES = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Low' },
];

// Add (taskId null) or edit a task. `defaultDate` pre-fills the due date for new tasks.
export function TaskSheet({ visible, taskId, defaultDate, onClose, onSaved }) {
  const { spacing } = useTheme();
  const editing = taskId !== null && taskId !== undefined;
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(toDateKey());
  const [priority, setPriority] = useState(2);
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { busy, error, setError, run } = useWrite();
  // Latest onClose without making the load effect re-run (and reset the form) when the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setError(null);
    setLoaded(false);
    if (!editing) {
      setTitle('');
      setNotes('');
      setDueDate(defaultDate === undefined ? toDateKey() : defaultDate);
      setPriority(2);
      setDone(false);
      setLoaded(true);
      return undefined;
    }
    (async () => {
      try {
        const task = await getTaskForEdit(await getDatabase(), taskId);
        if (cancelled) return;
        if (!task) {
          onCloseRef.current();
          return;
        }
        setTitle(task.title);
        setNotes(task.description ?? '');
        setDueDate(task.dueDate);
        setPriority(task.priority);
        setDone(task.done);
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setError("Couldn't load that task. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, editing, taskId, defaultDate, setError]);

  const finish = async (fn) => {
    const { ok } = await run(fn);
    if (ok) {
      await onSaved?.();
      onClose();
    }
  };

  const save = () =>
    finish((db) =>
      editing
        ? updateTask(db, taskId, { title, description: notes, dueDate, priority })
        : addTask(db, { title, description: notes, dueDate, priority }),
    );

  const confirmDelete = () =>
    Alert.alert('Delete this to-do?', 'It will be removed for good.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => finish((db) => deleteTask(db, taskId)) },
    ]);

  return (
    <BottomSheet visible={visible} title={editing ? 'Edit to-do' : 'Add to-do'} onClose={onClose}>
      <TextField label="What needs doing?" value={title} onChangeText={setTitle} placeholder="Call the bank" />
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything worth remembering"
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: spacing.md }}
      />
      <DatePickerField label="Due" value={dueDate} onChange={setDueDate} />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">Priority</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {PRIORITIES.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              selected={p.value === priority}
              accessibilityLabel={`${p.label} priority`}
              onPress={() => setPriority(p.value)}
            />
          ))}
        </View>
      </View>
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Save to-do'} onPress={save} disabled={busy || !loaded} />
      {editing ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            title={done ? 'Mark as not done' : 'Mark as done'}
            variant="soft"
            disabled={busy || !loaded}
            onPress={() => finish((db) => toggleTask(db, taskId))}
          />
          <Button
            title="Move to tomorrow"
            variant="soft"
            disabled={busy || !loaded}
            onPress={() => finish((db) => rescheduleTaskToTomorrow(db, taskId))}
          />
          <Button title="Delete" variant="outline" disabled={busy || !loaded} onPress={confirmDelete} />
        </View>
      ) : null}
    </BottomSheet>
  );
}
