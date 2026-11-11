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
import { refreshAfterRestore } from '../afterRestore';
import { backupFileName, createBackupText, inspectBackupText, restoreFromText } from '../backupService';
import { pickBackupText, removeCachedFile, shareBackupText } from '../backupFiles';

function messageFor(error, fallback) {
  return error instanceof ValidationError ? error.message : fallback;
}

export function BackupSection() {
  const { spacing } = useTheme();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(null);

  const exportBackup = async () => {
    setError(null);
    setNotice(null);
    setBusy('export');
    let file = null;
    try {
      const db = await getDatabase();
      const text = await createBackupText(db, { appVersion: Constants.expoConfig?.version ?? 'unknown' });
      file = await shareBackupText(text, backupFileName());
      setNotice('Your backup is ready. Keep the file somewhere you trust.');
    } catch (e) {
      setError(messageFor(e, "Couldn't create the backup. Please try again."));
    } finally {
      removeCachedFile(file);
      setBusy(null);
    }
  };

  const chooseFile = async () => {
    setError(null);
    setNotice(null);
    setBusy('pick');
    try {
      const picked = await pickBackupText();
      if (!picked) return;
      const db = await getDatabase();
      const info = await inspectBackupText(db, picked.text, picked.byteLength);
      setPending({ ...picked, summary: info.summary, exportedAt: info.exportedAt });
    } catch (e) {
      setError(messageFor(e, "Couldn't read that file. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setBusy('restore');
    setError(null);
    try {
      const db = await getDatabase();
      await restoreFromText(db, pending.text, pending.byteLength);
      await refreshAfterRestore();
      setPending(null);
      setNotice('Restored. Your data on this phone now matches the backup.');
    } catch (e) {
      setPending(null);
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
          Diary entries and their tags, expenses, budgets, savings, habits, to-dos, goals, mood, water,
          weight and sleep, and your settings and name.
        </AppText>
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">What is not included</AppText>
        <AppText variant="caption" muted>
          Photo image files. After a restore, entries keep their place but may show a placeholder where a
          photo was. Your PIN and reminder choices also stay on each phone.
        </AppText>
      </View>
      <AppText variant="caption" muted>
        The backup file is not encrypted. Anyone who has the file can read it.
      </AppText>

      <Button title="Create backup" onPress={exportBackup} disabled={busy !== null} />
      <Button title="Restore from a file" variant="outline" onPress={chooseFile} disabled={busy !== null} />
      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessibilityLiveRegion="polite">
          <ActivityIndicator />
          <AppText muted>Working…</AppText>
        </View>
      ) : null}
      <FormError message={error} />
      {notice ? (
        <AppText accessibilityLiveRegion="polite">{notice}</AppText>
      ) : null}

      <BottomSheet visible={pending !== null} title="Replace what is on this phone?" onClose={() => setPending(null)}>
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
            Restoring replaces everything currently in the app on this phone with the contents of this
            backup. This cannot be undone, so create a backup first if you might need what is here now.
          </AppText>
          <AppText variant="caption" muted>
            Photo files are not part of the backup, so some entries may show a placeholder.
          </AppText>
          <Button title="Replace my data" onPress={confirmRestore} disabled={busy !== null} />
          <Button title="Cancel" variant="outline" onPress={() => setPending(null)} disabled={busy !== null} />
        </View>
      </BottomSheet>
    </Card>
  );
}
