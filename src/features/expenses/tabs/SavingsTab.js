import { Archive, ArchiveRestore, CircleCheck, List, Pencil, PiggyBank, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { FormError } from '../../../components/common/FormError';
import { ProgressRing } from '../../../components/charts/ProgressRing';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatPaise } from '../../../utils/money';
import { formatDayMonthYear } from '../expenseMath';
import { IconButton, LoadGate } from '../parts';
import { AmountSheet, ContributionsSheet, GoalSheet } from '../sheets';
import { addContribution, archiveGoal, deleteGoal, getGoals } from '../savingsService';
import { useAction, useExpenseQuery } from '../useExpenseData';

function GoalCard({ goal, onAdd, onEdit, onHistory, onToggleArchive, onDelete }) {
  const { colors, spacing } = useTheme();
  const summary = `${goal.name}: ${formatPaise(goal.savedPaise)} saved of ${formatPaise(goal.targetPaise)}, ${goal.percent} percent${goal.complete ? ', goal reached' : ''}`;
  return (
    <Card tone={goal.complete ? 'accentSage' : 'surface'} style={{ gap: spacing.md }}>
      <View accessible accessibilityLabel={summary} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <ProgressRing progress={goal.ratio} size={72} strokeWidth={9} color={goal.complete ? colors.success : colors.primary}>
          {goal.complete ? (
            <CircleCheck color={colors.success} size={26} />
          ) : (
            <AppText variant="label">{goal.percent}%</AppText>
          )}
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading" numberOfLines={2}>
            {goal.name}
          </AppText>
          <AppText muted>
            {formatPaise(goal.savedPaise)} of {formatPaise(goal.targetPaise)}
          </AppText>
          {goal.complete ? (
            <AppText variant="caption" muted>
              Goal reached. Well done!
            </AppText>
          ) : (
            <AppText variant="caption" muted>
              {formatPaise(goal.remainingPaise)} to go{goal.deadline ? ` · by ${formatDayMonthYear(goal.deadline)}` : ''}
            </AppText>
          )}
        </View>
      </View>

      {goal.archived ? null : <Button title="Add savings" variant={goal.complete ? 'soft' : 'primary'} onPress={onAdd} />}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton Icon={List} label={`View savings history for ${goal.name}`} onPress={onHistory} />
        <IconButton Icon={Pencil} label={`Edit ${goal.name}`} onPress={onEdit} />
        <IconButton
          Icon={goal.archived ? ArchiveRestore : Archive}
          label={goal.archived ? `Restore ${goal.name}` : `Archive ${goal.name}`}
          onPress={onToggleArchive}
        />
        <IconButton Icon={Trash2} label={`Delete ${goal.name}`} color={colors.danger} onPress={onDelete} />
      </View>
    </Card>
  );
}

export function SavingsTab({ goalSheetOpen, onGoalSheetClose }) {
  const { colors, spacing } = useTheme();
  const query = useExpenseQuery((db) => getGoals(db), []);
  const action = useAction();
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null);
  const [history, setHistory] = useState(null);

  const mutate = async (task) => {
    const ok = await action.run(task);
    if (ok) query.reload();
  };

  const confirmDelete = (goal) =>
    Alert.alert(
      `Delete "${goal.name}"?`,
      goal.contributionCount > 0
        ? `This also removes its ${goal.contributionCount} saved ${goal.contributionCount === 1 ? 'entry' : 'entries'}. This can't be undone.`
        : "This can't be undone.",
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => mutate((db) => deleteGoal(db, goal.id)) },
      ],
    );

  return (
    <>
      <FormError message={action.error} />
      <LoadGate query={query}>
        {({ active, archived }) => (
          <>
            {active.length === 0 ? (
              <EmptyState
                icon={<PiggyBank color={colors.primary} size={32} />}
                title="No savings goals yet"
                message="Pick something you're saving for and add to it whenever you can. There's no deadline pressure."
              />
            ) : (
              active.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onAdd={() => setAdding(g)}
                  onEdit={() => setEditing(g)}
                  onHistory={() => setHistory(g)}
                  onToggleArchive={() => mutate((db) => archiveGoal(db, g.id, true))}
                  onDelete={() => confirmDelete(g)}
                />
              ))
            )}

            {archived.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <AppText variant="heading">Archived</AppText>
                {archived.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    onAdd={() => {}}
                    onEdit={() => setEditing(g)}
                    onHistory={() => setHistory(g)}
                    onToggleArchive={() => mutate((db) => archiveGoal(db, g.id, false))}
                    onDelete={() => confirmDelete(g)}
                  />
                ))}
              </View>
            ) : null}

            {active.length === 0 ? <Button title="Create a goal" onPress={() => setEditing({})} style={{ alignSelf: 'center' }} /> : null}
          </>
        )}
      </LoadGate>

      <GoalSheet
        visible={goalSheetOpen || editing !== null}
        goal={editing && editing.id ? editing : null}
        onClose={() => {
          setEditing(null);
          onGoalSheetClose();
        }}
        onSaved={query.reload}
      />

      <AmountSheet
        visible={adding !== null}
        title={adding ? `Add to ${adding.name}` : ''}
        label="Amount saved (₹)"
        description="Add what you've put aside. Every bit counts."
        noteLabel="Note"
        submitLabel="Add savings"
        onClose={() => setAdding(null)}
        onSubmit={async (db, paise, note) => {
          await addContribution(db, adding.id, { amountPaise: paise, note });
          query.reload();
        }}
      />

      <ContributionsSheet visible={history !== null} goal={history} onClose={() => setHistory(null)} />
    </>
  );
}
