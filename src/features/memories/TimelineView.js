import { useRouter } from 'expo-router';
import { BookHeart, Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { useTheme } from '../../theme/ThemeProvider';
import { formatMonthKey, formatShortDate } from '../../utils/dates';
import { MemoryPhoto } from './MemoryPhoto';

const MAX_PHOTOS_SHOWN = 3;

function EntryRow({ entry, onPress }) {
  const { colors, spacing, radii } = useTheme();
  const title = entry.title ?? (entry.preview ? entry.preview.slice(0, 40) : 'Untitled');
  const shown = entry.photos.slice(0, MAX_PHOTOS_SHOWN);
  const extra = entry.photos.length - shown.length;
  const label = `${title}, ${formatShortDate(entry.date)}${entry.favorite ? ', favourite' : ''}${
    entry.photos.length ? `, ${entry.photos.length} photo${entry.photos.length === 1 ? '' : 's'}` : ''
  }`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ gap: spacing.sm, opacity: pressed ? 0.75 : 1, minHeight: 48 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppText variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </AppText>
        {entry.favorite ? <Star color={colors.primary} size={16} fill={colors.primary} /> : null}
        <AppText variant="caption" muted>
          {formatShortDate(entry.date)}
        </AppText>
      </View>
      {entry.title && entry.preview ? (
        <AppText muted numberOfLines={2}>
          {entry.preview}
        </AppText>
      ) : null}
      {shown.length ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {shown.map((p, i) => (
            <View key={p.id} style={{ flex: 1, aspectRatio: 1, borderRadius: radii.md, overflow: 'hidden' }}>
              <MemoryPhoto uri={p.uri} style={{ width: '100%', height: '100%' }} accessibilityLabel={`Photo ${i + 1}`} />
              {i === shown.length - 1 && extra > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    left: 0,
                    top: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(40, 25, 30, 0.45)',
                  }}
                >
                  <AppText variant="heading" color={colors.onPrimary}>
                    +{extra}
                  </AppText>
                </View>
              ) : null}
            </View>
          ))}
          {Array.from({ length: MAX_PHOTOS_SHOWN - shown.length }, (_, i) => (
            <View key={`pad-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export function TimelineView({ timeline }) {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const open = (id) => router.push(`/diary/${id}`);

  if (timeline.total === 0) {
    return (
      <EmptyState
        icon={<BookHeart size={32} color={colors.primary} />}
        title="No memories yet"
        message="Entries you write in your diary will gather here, with their photos, month by month."
      />
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {timeline.onThisDay.length ? (
        <Card tone="accentButter" style={{ gap: spacing.md }}>
          <AppText variant="heading" accessibilityRole="header">
            On this day
          </AppText>
          {timeline.onThisDay.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.title ?? e.preview.slice(0, 40)}, ${e.date.slice(0, 4)}`}
              onPress={() => open(e.id)}
              style={{ minHeight: 48, justifyContent: 'center', gap: 2 }}
            >
              <AppText variant="label">{e.date.slice(0, 4)}</AppText>
              <AppText numberOfLines={2}>{e.title ?? e.preview}</AppText>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {timeline.groups.map((group) => (
        <View key={group.monthKey} style={{ gap: spacing.sm }}>
          <AppText variant="heading" accessibilityRole="header">
            {formatMonthKey(group.monthKey)}
          </AppText>
          <Card style={{ gap: spacing.lg }}>
            {group.entries.map((e) => (
              <EntryRow key={e.id} entry={e} onPress={() => open(e.id)} />
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}
