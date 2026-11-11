import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from 'expo-router';
import { CalendarDays, Clock, Heart, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Chip } from '../../components/common/Chip';
import { FormError } from '../../components/common/FormError';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { MOODS } from '../../constants/moods';
import { useTheme } from '../../theme/ThemeProvider';
import { formatLongDate } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { DateSheet, TimeSheet } from './components/DateTimeSheets';
import { MOOD_ICONS } from './components/moodIcons';
import { PhotoBanner } from './components/PhotoBanner';
import { diaryActions } from './diaryActions';
import { cleanTagName, formatTime12, MAX_PHOTOS, MAX_TAG_LENGTH, MAX_TAGS_PER_ENTRY } from './diaryLogic';

let photoKeySeed = 0;
const nextPhotoKey = () => `new-${++photoKeySeed}`;

// Draft photos are { key, uri, id?, width?, height? }. `id` marks a photo already saved on the entry.
function toDraft(initial) {
  return {
    title: initial.title ?? '',
    content: initial.content ?? '',
    entryDate: initial.entryDate,
    entryTime: initial.entryTime,
    mood: initial.mood ?? null,
    isFavorite: Boolean(initial.isFavorite),
    tagNames: initial.tagNames ?? [],
    photos: (initial.photos ?? []).map((p) => ({ key: p.id ?? nextPhotoKey(), ...p })),
  };
}

function snapshotOf(draft) {
  return JSON.stringify({ ...draft, photos: draft.photos.map((p) => p.id ?? p.uri) });
}

// Shared by New Entry and Edit Entry. `onSave(input)` resolves to the entry id; `onSaved(id)` navigates on.
export function EntryForm({ heading, initial, submitLabel, onSave, onSaved }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  const navigation = useNavigation();

  const [draft, setDraft] = useState(() => toDraft(initial));
  const baseline = useRef(snapshotOf(draft));
  const [availableTags, setAvailableTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [tagError, setTagError] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const saved = useRef(false);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = snapshotOf(draft) !== baseline.current;

  useEffect(() => {
    diaryActions.tags().then(setAvailableTags, () => {});
  }, []);

  // Ask before leaving with unsaved changes (header back, Android back button and gesture).
  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (saved.current || !dirty) return;
      event.preventDefault();
      Alert.alert('Leave without saving?', 'The changes to this entry will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
      ]);
    });
  }, [navigation, dirty]);

  const pickPhotos = useCallback(async () => {
    const room = MAX_PHOTOS - draft.photos.length;
    if (room <= 0) return;
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      setDraft((d) => ({
        ...d,
        photos: [
          ...d.photos,
          ...result.assets
            .slice(0, MAX_PHOTOS - d.photos.length)
            .map((a) => ({ key: nextPhotoKey(), uri: a.uri, width: a.width, height: a.height })),
        ],
      }));
    } catch {
      setError("Couldn't open your photos. Please try again.");
    }
  }, [draft.photos.length]);

  const toggleTag = (name) => {
    setTagError(null);
    setDraft((d) => {
      const has = d.tagNames.some((t) => t.toLowerCase() === name.toLowerCase());
      return { ...d, tagNames: has ? d.tagNames.filter((t) => t.toLowerCase() !== name.toLowerCase()) : [...d.tagNames, name] };
    });
  };

  const addNewTag = () => {
    const name = cleanTagName(newTag);
    if (!name) return;
    if (name.length > MAX_TAG_LENGTH) {
      setTagError(`Tag names can be up to ${MAX_TAG_LENGTH} characters.`);
      return;
    }
    const existing = availableTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const label = existing ? existing.name : name;
    if (!draft.tagNames.some((t) => t.toLowerCase() === label.toLowerCase())) {
      if (draft.tagNames.length >= MAX_TAGS_PER_ENTRY) {
        setTagError(`Use up to ${MAX_TAGS_PER_ENTRY} tags per entry.`);
        return;
      }
      set({ tagNames: [...draft.tagNames, label] });
    }
    setNewTag('');
    setTagError(null);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await onSave({
        title: draft.title,
        content: draft.content,
        entryDate: draft.entryDate,
        entryTime: draft.entryTime,
        mood: draft.mood,
        isFavorite: draft.isFavorite,
        tagNames: draft.tagNames,
        photos: draft.photos.map((p) => (p.id ? { id: p.id } : { uri: p.uri, width: p.width, height: p.height })),
      });
      saved.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved(id);
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "Couldn't save that. Please try again.");
      setBusy(false);
    }
  };

  // Tags to show: the saved ones, then any custom names picked in this form that aren't saved yet.
  const knownNames = new Set(availableTags.map((t) => t.name.toLowerCase()));
  const tagOptions = [
    ...availableTags.map((t) => t.name),
    ...draft.tagNames.filter((n) => !knownNames.has(n.toLowerCase())),
  ];

  const inputStyle = {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  };

  return (
    <Screen>
      <ScreenHeader title={heading} back />

      <PhotoBanner
        photos={draft.photos}
        disabled={busy}
        onAdd={pickPhotos}
        onRemove={(key) => set({ photos: draft.photos.filter((p) => p.key !== key) })}
      />

      <TextField
        label="Title"
        value={draft.title}
        onChangeText={(title) => set({ title })}
        placeholder="Give this day a name"
        maxLength={120}
        returnKeyType="next"
      />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">Your thoughts</AppText>
        <TextInput
          accessibilityLabel="Your thoughts"
          value={draft.content}
          onChangeText={(content) => set({ content })}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={[{ minHeight: 160, fontSize: 16, lineHeight: 24 }, inputStyle]}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">How were you feeling?</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {MOODS.map((m) => {
            const Icon = MOOD_ICONS[m.value];
            const selected = draft.mood === m.value;
            return (
              <Pressable
                key={m.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${m.label} mood`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  set({ mood: selected ? null : m.value });
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 62,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  borderRadius: radii.md,
                  borderWidth: 2,
                  borderColor: selected ? colors.primary : 'transparent',
                  backgroundColor: colors[m.tone],
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Icon color={colors.text} size={22} />
                <AppText variant="caption" style={{ fontWeight: '600' }}>
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card style={{ gap: spacing.sm, padding: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Date: ${formatLongDate(draft.entryDate)}. Change date`}
          onPress={() => setSheet('date')}
          style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <CalendarDays color={colors.primary} size={22} />
          <AppText style={{ flex: 1 }}>{formatLongDate(draft.entryDate)}</AppText>
          <AppText variant="label" color={colors.primary}>
            Change
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Time: ${formatTime12(draft.entryTime)}. Change time`}
          onPress={() => setSheet('time')}
          style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <Clock color={colors.primary} size={22} />
          <AppText style={{ flex: 1 }}>{formatTime12(draft.entryTime)}</AppText>
          <AppText variant="label" color={colors.primary}>
            Change
          </AppText>
        </Pressable>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">Tags</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {tagOptions.map((name) => (
            <Chip
              key={name}
              label={name}
              selected={draft.tagNames.some((t) => t.toLowerCase() === name.toLowerCase())}
              onPress={() => toggleTag(name)}
              accessibilityLabel={`Tag ${name}`}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="New tag"
              value={newTag}
              onChangeText={setNewTag}
              placeholder="e.g. Travel"
              maxLength={MAX_TAG_LENGTH + 6}
              returnKeyType="done"
              onSubmitEditing={addNewTag}
              error={tagError}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add tag"
            onPress={addNewTag}
            style={{
              marginTop: spacing.xl - 4,
              width: touchTarget,
              height: touchTarget,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primarySoft,
            }}
          >
            <Plus color={colors.primary} size={22} />
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: draft.isFavorite }}
        accessibilityLabel="Mark as a favourite"
        onPress={() => set({ isFavorite: !draft.isFavorite })}
        style={{ minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <Heart color={colors.primary} fill={draft.isFavorite ? colors.primary : 'none'} size={22} />
        <AppText style={{ flex: 1 }}>Mark as a favourite</AppText>
      </Pressable>

      <FormError message={error} />
      <Button title={busy ? 'Saving…' : submitLabel} onPress={submit} disabled={busy} />

      <DateSheet
        visible={sheet === 'date'}
        value={draft.entryDate}
        onPick={(entryDate) => set({ entryDate })}
        onClose={() => setSheet(null)}
      />
      <TimeSheet
        visible={sheet === 'time'}
        value={draft.entryTime}
        onPick={(entryTime) => set({ entryTime })}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}
