import { BookHeart, Heart, Images } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Card } from '../../../components/common/Card';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatShortDate } from '../../../utils/dates';
import { formatTime12, splitTitle, toSnippet } from '../diaryLogic';
import { MOOD_ICONS, moodOf } from './moodIcons';
import { PhotoImage } from './PhotoImage';
import { TagPill } from './Pills';

const THUMB = 76;

export function EntryCard({ entry, onPress }) {
  const { colors, spacing, radii } = useTheme();
  const { title, body } = splitTitle({ title: entry.title, content: entry.snippet });
  const showSnippet = toSnippet(body);
  const mood = moodOf(entry.mood);
  const MoodIcon = mood ? MOOD_ICONS[mood.value] : null;
  const when = `${formatShortDate(entry.entryDate)} · ${formatTime12(entry.entryTime)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        title,
        when,
        mood ? `mood ${mood.label}` : null,
        entry.isFavorite ? 'favourite' : null,
        entry.photoCount > 0 ? `${entry.photoCount} ${entry.photoCount === 1 ? 'photo' : 'photos'}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Opens the entry"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
    >
      <Card style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md }}>
        <View>
          {entry.thumbnailUri ? (
            <PhotoImage uri={entry.thumbnailUri} style={{ width: THUMB, height: THUMB, borderRadius: radii.md }} />
          ) : (
            <View
              style={{
                width: THUMB,
                height: THUMB,
                borderRadius: radii.md,
                backgroundColor: colors.accentLavender,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookHeart color={colors.text} size={28} />
            </View>
          )}
          {entry.photoCount > 1 ? (
            <View
              style={{
                position: 'absolute',
                right: spacing.xs,
                bottom: spacing.xs,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
                paddingHorizontal: spacing.sm,
                borderRadius: radii.pill,
                backgroundColor: colors.surface,
              }}
            >
              <Images color={colors.text} size={12} />
              <AppText variant="caption" style={{ fontWeight: '600' }}>
                {entry.photoCount}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </AppText>
            {entry.isFavorite ? <Heart color={colors.primary} fill={colors.primary} size={16} /> : null}
          </View>
          {showSnippet ? (
            <AppText muted numberOfLines={2}>
              {showSnippet}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {MoodIcon ? <MoodIcon color={colors.textMuted} size={14} /> : null}
            <AppText variant="caption" muted>
              {when}
            </AppText>
          </View>
          {entry.tags.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {entry.tags.slice(0, 3).map((t) => (
                <TagPill key={t.id} name={t.name} />
              ))}
              {entry.tags.length > 3 ? <TagPill name={`+${entry.tags.length - 3}`} /> : null}
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
