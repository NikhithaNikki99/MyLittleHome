import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme } from '../../theme/ThemeProvider';
import { EntryForm } from './EntryForm';
import { diaryActions } from './diaryActions';

export default function EditEntryScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const entryId = Array.isArray(id) ? id[0] : id;
  const [state, setState] = useState({ status: 'loading', entry: null });

  useEffect(() => {
    let active = true;
    diaryActions.get(entryId).then(
      (entry) => active && setState({ status: entry ? 'ready' : 'missing', entry }),
      () => active && setState({ status: 'error', entry: null }),
    );
    return () => {
      active = false;
    };
  }, [entryId]);

  if (state.status !== 'ready') {
    return (
      <Screen>
        <ScreenHeader title="Edit Entry" back />
        {state.status === 'loading' ? (
          <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <Card style={{ gap: spacing.md }}>
            <AppText variant="heading">{state.status === 'missing' ? 'This entry is no longer here' : "We couldn't open this entry"}</AppText>
            <AppText muted>Nothing has been changed.</AppText>
            <Button title="Back to diary" onPress={() => router.replace('/diary')} />
          </Card>
        )}
      </Screen>
    );
  }

  const { entry } = state;
  return (
    <EntryForm
      heading="Edit Entry"
      initial={{
        title: entry.title,
        content: entry.content,
        entryDate: entry.entryDate,
        entryTime: entry.entryTime,
        mood: entry.mood,
        isFavorite: entry.isFavorite,
        tagNames: entry.tags.map((t) => t.name),
        photos: entry.photos,
      }}
      submitLabel="Save changes"
      onSave={async (input) => {
        await diaryActions.update(entry.id, input);
        return entry.id;
      }}
      onSaved={() => router.back()}
    />
  );
}
