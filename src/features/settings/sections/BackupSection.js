import Constants from 'expo-constants';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { FormError } from '../../../components/common/FormError';
import { getDatabase } from '../../../database/client';
import { useTheme } from '../../../theme/ThemeProvider';
import { ValidationError } from '../../../utils/errors';
import { cancelArchiveRestore, confirmArchiveRestore, exportCompleteBackup, pickAndInspectBackup } from '../../export/exportActions';
import { readPickedText } from '../../export/exportFiles';
import { refreshAfterRestore } from '../afterRestore';
import { backupFileName, createBackupText, inspectBackupText, restoreFromText } from '../backupService';
import { removeCachedFile, shareBackupText } from '../backupFiles';

function messageFor(error, fallback) {
  return error instanceof ValidationError ? error.message : fallback;
}

export function BackupSection() {
  const { spacing } = useTheme();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // pending: { kind: 'json' | 'archive', summary, exportedAt, ... } while the confirmation sheet is open.
  const [pending, setPending] = useState(null);

  const begin = (name) => {
    setError(null);
    setNotice(null);
    setBusy(name);
  };

  const exportComplete = async () => {
    begin('export');
    try {
      const { photoCount, missingPhotoCount } = await exportCompleteBackup();
      setNotice(
        missingPhotoCount > 0
          ? `Your backup is ready with ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}. ${missingPhotoCount} could not be included because the file was missing on this phone.`
          : 'Your backup is ready, with your photos. Keep the file somewhere you trust.',
      );
    } catch (e) {
      setError(messageFor(e, "Couldn't create the backup. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const exportDataOnly = async () => {
    begin('export-json');
    let file = null;
    try {
      const db = await getDatabase();
      const text = await createBackupText(db, { appVersion: Constants.expoConfig?.version ?? 'unknown' });
      file = await shareBackupText(text, backupFileName());
      setNotice('Your data-only backup is ready. It does not include photo files.');
    } catch (e) {
      setError(messageFor(e, "Couldn't create the backup. Please try again."));
    } finally {
      removeCachedFile(file);
      setBusy(null);
    }
  };

  const chooseFile = async () => {
    begin('pick');
    try {
      const found = await pickAndInspectBackup();
      if (!found) return;
      if (found.kind === 'archive') {
        setPending({
          kind: 'archive',
          found,
          summary: found.inspected.summary,
          exportedAt: found.inspected.exportedAt,
        });
        return;
      }
      const picked = await readPickedText(found.picked);
      const db = await getDatabase();
      const info = await inspectBackupText(db, picked.text, picked.byteLength);
      setPending({ kind: 'json', picked, summary: info.summary, exportedAt: info.exportedAt });
    } catch (e) {
      setError(messageFor(e, "Couldn't read that file. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const closePending = async () => {
    const current = pending;
    setPending(null);
    if (current?.kind === 'archive') await cancelArchiveRestore(current.found).catch(() => {});
  };

  const confirmRestore = async () => {
    if (!pending) return;
    const current = pending;
    begin('restore');
    try {
      if (current.kind === 'archive') {
        const { failedPhotoMoves } = await confirmArchiveRestore(current.found);
        setNotice(
          failedPhotoMoves > 0
            ? `Restored. ${failedPhotoMoves} ${failedPhotoMoves === 1 ? 'photo' : 'photos'} could not be saved and will show a placeholder.`
            : 'Restored. Your data and photos on this phone now match the backup.',
        );
      } else {
        const db = await getDatabase();
        await restoreFromText(db, current.picked.text, current.picked.byteLength);
        await refreshAfterRestore();
        setNotice('Restored. Your data on this phone now matches the backup. This file had no photo files.');
      }
      setPending(null);
    } catch (e) {
      setPending(null);
      if (current.kind === 'archive') await cancelArchiveRestore(current.found).catch(() => {});
      setError(messageFor(e, "Couldn't restore that backup, so nothing was changed. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="heading" accessibilityRole="header">
        Backup and restore
      </AppText>
      <AppText variant="caption" muted>
        Your data lives only on this phone. A backup is a single file you can save or send to yourself.
      </AppText>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">What is included</AppText>
        <AppText variant="caption" muted>
          Diary entries with their photos and tags, expenses, subscriptions, budgets, savings, habits, to-dos, goals,
          mood, water, weight, sleep, monthly reflections, and your settings and name.
        </AppText>
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">What is not included</AppText>
        <AppText variant="caption" muted>
          Your PIN, app lock and reminder choices stay on each phone and are never put in a backup.
        </AppText>
      </View>
      <AppText variant="caption" muted>
        The backup file is not encrypted. Anyone who has the file can read it, photos included.
      </AppText>

      <Button title="Create backup (with photos)" onPress={exportComplete} disabled={busy !== null} />
      <Button title="Create data-only backup" variant="soft" onPress={exportDataOnly} disabled={busy !== null} />
      <Button title="Restore from a file" variant="outline" onPress={chooseFile} disabled={busy !== null} />
      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessibilityLiveRegion="polite">
          <ActivityIndicator />
          <AppText muted>Working. Large backups can take a minute…</AppText>
        </View>
      ) : null}
      <FormError message={error} />
      {notice ? <AppText accessibilityLiveRegion="polite">{notice}</AppText> : null}

      <BottomSheet visible={pending !== null} title="Replace what is on this phone?" onClose={closePending}>
        <View style={{ gap: spacing.md }}>
          <AppText>This backup contains:</AppText>
          <View style={{ gap: spacing.xs }}>
            {pending?.summary.length ? (
              pending.summary.map((line) => <AppText key={line}>• {line}</AppText>)
            ) : (
              <AppText muted>No entries (an empty backup).</AppText>
            )}
          </View>
          {pending?.exportedAt ? (
            <AppText variant="caption" muted>
              Made on {new Date(pending.exportedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </AppText>
          ) : null}
          <AppText>
            Restoring replaces everything currently in the app on this phone with the contents of this backup. This
            cannot be undone, so create a backup first if you might need what is here now.
          </AppText>
          {pending?.kind === 'json' ? (
            <AppText variant="caption" muted>
              This is a data-only file, so photos currently in your diary will no longer be linked and entries may show a
              placeholder.
            </AppText>
          ) : null}
          <Button title="Replace my data" onPress={confirmRestore} disabled={busy !== null} />
          <Button title="Cancel" variant="outline" onPress={closePending} disabled={busy !== null} />
        </View>
      </BottomSheet>
    </Card>
  );
}
