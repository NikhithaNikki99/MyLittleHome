import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { FormError } from '../../../components/common/FormError';
import { MonthSwitcher } from '../../../components/common/MonthSwitcher';
import { useTheme } from '../../../theme/ThemeProvider';
import { monthKeyOf, toDateKey } from '../../../utils/dates';
import { ValidationError } from '../../../utils/errors';
import { exportCsv, exportMonthlyPdf, shareCsv } from '../../export/exportActions';

function messageFor(error, fallback) {
  return error instanceof ValidationError ? error.message : fallback;
}

export function ExportSection() {
  const { spacing } = useTheme();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [csvFiles, setCsvFiles] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(toDateKey()));

  const start = (name) => {
    setBusy(name);
    setError(null);
    setNotice(null);
  };

  const openCsv = async () => {
    start('csv');
    try {
      setCsvFiles(await exportCsv());
    } catch (e) {
      setError(messageFor(e, "Couldn't prepare the spreadsheets. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const shareOne = async (file) => {
    start('csv-share');
    try {
      await shareCsv(file);
      setNotice(`${file.label} is ready. Keep the file somewhere you trust.`);
      setCsvFiles(null);
    } catch (e) {
      setError(messageFor(e, "Couldn't share that file. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const makePdf = async () => {
    start('pdf');
    try {
      await exportMonthlyPdf(monthKey);
      setPdfOpen(false);
      setNotice('Your report is ready. Keep the file somewhere you trust.');
    } catch (e) {
      setError(messageFor(e, "Couldn't create the report. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="heading" accessibilityRole="header">
        Export
      </AppText>
      <AppText variant="caption" muted>
        Take a copy of your data to read or keep. These files are not encrypted, and they do not include your PIN or
        any lock settings.
      </AppText>
      <Button title="Spreadsheets (CSV)" variant="outline" onPress={openCsv} disabled={busy !== null} />
      <Button title="Monthly report (PDF)" variant="outline" onPress={() => setPdfOpen(true)} disabled={busy !== null} />
      {busy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessibilityLiveRegion="polite">
          <ActivityIndicator />
          <AppText muted>Working…</AppText>
        </View>
      ) : null}
      <FormError message={error} />
      {notice ? <AppText accessibilityLiveRegion="polite">{notice}</AppText> : null}

      <BottomSheet visible={csvFiles !== null} title="Choose what to export" onClose={() => setCsvFiles(null)}>
        <View style={{ gap: spacing.sm }}>
          <AppText muted>Each file opens in any spreadsheet app. Only the ones with something in them are listed.</AppText>
          {csvFiles?.map((file) => (
            <Button
              key={file.fileName}
              title={`${file.label} (${file.rowCount})`}
              variant="soft"
              onPress={() => shareOne(file)}
              disabled={busy !== null}
            />
          ))}
          <Button title="Close" variant="outline" onPress={() => setCsvFiles(null)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={pdfOpen} title="Monthly report" onClose={() => setPdfOpen(false)}>
        <View style={{ gap: spacing.md }}>
          <AppText muted>A one-page summary of the month: spending, mood, habits, diary entries and your reflection.</AppText>
          <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />
          <FormError message={error} />
          <Button title={busy === 'pdf' ? 'Creating…' : 'Create PDF'} onPress={makePdf} disabled={busy !== null} />
          <Button title="Cancel" variant="outline" onPress={() => setPdfOpen(false)} disabled={busy !== null} />
        </View>
      </BottomSheet>
    </Card>
  );
}
