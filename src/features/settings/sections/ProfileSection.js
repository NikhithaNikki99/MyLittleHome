import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { MAX_PROFILE_NAME_LENGTH, useSettingsStore } from '../../../store/settingsStore';
import { useTheme } from '../../../theme/ThemeProvider';
import { ValidationError } from '../../../utils/errors';
import { changeProfileName } from '../settingsService';

// Name is optional; it only appears in the Home greeting and stays on this phone.
export function ProfileSection() {
  const { spacing } = useTheme();
  const saved = useSettingsStore((s) => s.profileName);
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const dirty = draft.trim().replace(/\s+/g, ' ') !== saved;

  const save = async () => {
    setError(null);
    setStatus(null);
    try {
      await changeProfileName(draft);
      setStatus('Saved');
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "Couldn't save your name. Please try again.");
    }
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="heading" accessibilityRole="header">
        My profile
      </AppText>
      <TextField
        label="Your name"
        value={draft}
        onChangeText={(t) => {
          setDraft(t);
          setStatus(null);
        }}
        placeholder="Optional"
        maxLength={MAX_PROFILE_NAME_LENGTH + 10}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={save}
        error={error}
      />
      <AppText variant="caption" muted>
        Shown in your Home greeting. It never leaves this phone.
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Button title="Save name" onPress={save} disabled={!dirty} />
        {status ? (
          <AppText muted accessibilityLiveRegion="polite">
            {status}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}
