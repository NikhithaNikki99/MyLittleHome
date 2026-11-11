import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { FormError } from '../../components/common/FormError';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTheme } from '../../theme/ThemeProvider';
import { formatLongDate } from '../../utils/dates';
import { HeaderIconButton } from './components/HeaderIconButton';
import { PhotoImage } from './components/PhotoImage';
import { MoodPill, TagPill } from './components/Pills';
import { diaryActions } from './diaryActions';
import { formatTime12, splitTitle } from './diaryLogic';

function PhotoCarousel({ photos }) {
  const { spacing, radii } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const width = screenWidth - spacing.lg * 2;
  const height = Math.round(width * 0.75);

  return (
    <View style={{ gap: spacing.xs }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width, borderRadius: radii.lg }}
        accessibilityLabel={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
      >
        {photos.map((p, i) => (
          <PhotoImage
            key={p.id}
            uri={p.uri}
            iconSize={40}
            accessibilityLabel={`Photo ${i + 1} of ${photos.length}`}
            style={{ width, height, borderRadius: radii.lg }}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          Swipe to see all {photos.length} photos
        </AppText>
      ) : null}
    </View>
  );
}

export default function EntryDetailScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const entryId = Array.isArray(id) ? id[0] : id;

  const [state, setState] = useState({ status: 'loading', entry: null });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let active = true;
    diaryActions.get(entryId).then(
      (entry) => active && setState({ status: entry ? 'ready' : 'missing', entry }),
      () => active && setState((s) => ({ ...s, status: 'error' })),
    );
    return () => {
      active = false;
    };
  }, [entryId]);

  // Reload on focus so edits made on the next screen show up when you come back.
  useFocusEffect(load);

  const toggleFavorite = async () => {
    if (!state.entry || busy) return;
    setBusy(true);
    setError(null);
    try {
      await diaryActions.setFavorite(state.entry.id, !state.entry.isFavorite);
      setState((s) => ({ ...s, entry: { ...s.entry, isFavorite: !s.entry.isFavorite } }));
    } catch {
      setError("Couldn't update that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete this entry?', 'Its photos and tags on this entry will be removed from your device. This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            await diaryActions.remove(entryId);
            router.back();
          } catch {
            setError("Couldn't delete that. Please try again.");
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (state.status === 'loading') {
    return (
      <Screen>
        <ScreenHeader title="Entry" back />
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (state.status === 'missing' || state.status === 'error' || !state.entry) {
    return (
      <Screen>
        <ScreenHeader title="Entry" back />
        <Card style={{ gap: spacing.md }}>
          <AppText variant="heading">
            {state.status === 'missing' ? 'This entry is no longer here' : "We couldn't open this entry"}
          </AppText>
          <AppText muted>Nothing has been changed.</AppText>
          <Button title="Back to diary" onPress={() => router.replace('/diary')} />
        </Card>
      </Screen>
    );
  }

  const { entry } = state;
  const { title, body } = splitTitle(entry);

  return (
    <Screen>
      <ScreenHeader
        title="Entry"
        back
        trailing={
          <HeaderIconButton
            Icon={Heart}
            filled
            selected={entry.isFavorite}
            label={entry.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            onPress={toggleFavorite}
          />
        }
      />

      {entry.photos.length > 0 ? <PhotoCarousel photos={entry.photos} /> : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        <AppText muted>
          {formatLongDate(entry.entryDate)} · {formatTime12(entry.entryTime)}
        </AppText>
        {entry.mood || entry.tags.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <MoodPill mood={entry.mood} />
            {entry.tags.map((t) => (
              <TagPill key={t.id} name={t.name} />
            ))}
          </View>
        ) : null}
      </View>

      {body ? (
        <Card>
          <AppText selectable>{body}</AppText>
        </Card>
      ) : null}

      <FormError message={error} />

      <View style={{ gap: spacing.sm }}>
        <Button title="Edit entry" variant="soft" onPress={() => router.push(`/diary/${entry.id}/edit`)} disabled={busy} />
        <Button title="Delete entry" variant="outline" onPress={confirmDelete} disabled={busy} />
      </View>
    </Screen>
  );
}
