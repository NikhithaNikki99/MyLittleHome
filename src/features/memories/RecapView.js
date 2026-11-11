import { useRouter } from 'expo-router';
import { Droplets, NotebookPen, Smile, Sprout, Wallet } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { MOODS } from '../../constants/moods';
import { useTheme } from '../../theme/ThemeProvider';
import { formatShortDate } from '../../utils/dates';
import { formatPaise } from '../../utils/money';
import { formatMl } from '../../utils/units';
import { MemoryPhoto } from './MemoryPhoto';
import { ReflectionCard } from './ReflectionCard';

function Stat({ icon, tone, label, value, detail }) {
  const { spacing } = useTheme();
  return (
    <Card
      tone={tone}
      style={{ width: '48%', flexGrow: 1, gap: spacing.xs, padding: spacing.md }}
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {icon}
        <AppText variant="caption">{label}</AppText>
      </View>
      <AppText variant="title">{value}</AppText>
      {detail ? (
        <AppText variant="caption" muted>
          {detail}
        </AppText>
      ) : null}
    </Card>
  );
}

function MoodBars({ recap }) {
  const { colors, spacing, radii } = useTheme();
  const max = Math.max(1, ...Object.values(recap.moodCounts));
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Smile color={colors.primary} size={18} />
        <AppText variant="heading" accessibilityRole="header">
          Mood check-ins
        </AppText>
      </View>
      {recap.moodTotal === 0 ? (
        <AppText muted>No check-ins this month.</AppText>
      ) : (
        MOODS.map((m) => (
          <View
            key={m.value}
            accessible
            accessibilityLabel={`${m.label}: ${recap.moodCounts[m.value]} ${recap.moodCounts[m.value] === 1 ? 'day' : 'days'}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <AppText variant="label" style={{ width: 52 }}>
              {m.label}
            </AppText>
            <View style={{ flex: 1, height: 14, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${(recap.moodCounts[m.value] / max) * 100}%`,
                  height: '100%',
                  borderRadius: radii.pill,
                  backgroundColor: colors[m.tone],
                  borderWidth: recap.moodCounts[m.value] ? 1 : 0,
                  borderColor: colors.border,
                }}
              />
            </View>
            <AppText variant="label" style={{ width: 24, textAlign: 'right' }}>
              {recap.moodCounts[m.value]}
            </AppText>
          </View>
        ))
      )}
    </Card>
  );
}

function MomentsCard({ moment }) {
  const router = useRouter();
  const { spacing, radii } = useTheme();
  const photo = moment.photos[0];
  const title = moment.title ?? (moment.preview ? moment.preview.slice(0, 40) : 'A little moment');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`My little moments: ${title}, ${formatShortDate(moment.date)}. Open entry`}
      onPress={() => router.push(`/diary/${moment.id}`)}
    >
      <Card tone="accentPink" style={{ gap: spacing.md }}>
        <AppText variant="heading" accessibilityRole="header">
          My little moments
        </AppText>
        {photo ? (
          <View style={{ height: 180, borderRadius: radii.md, overflow: 'hidden' }}>
            <MemoryPhoto uri={photo.uri} style={{ width: '100%', height: '100%' }} accessibilityLabel="Moment photo" />
          </View>
        ) : null}
        <View style={{ gap: 2 }}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="caption" muted>
            {formatShortDate(moment.date)}
            {moment.favorite ? ' · a favourite' : ''}
          </AppText>
          {moment.title && moment.preview ? <AppText numberOfLines={3}>{moment.preview}</AppText> : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function RecapView({ recap, canReflect = true, onEditReflection }) {
  const { colors, spacing } = useTheme();
  const reflectionCard = (
    <ReflectionCard monthKey={recap.monthKey} reflection={recap.reflection} canWrite={canReflect} onEdit={onEditReflection} />
  );

  if (recap.isEmpty) {
    return (
      <View style={{ gap: spacing.lg }}>
        <EmptyState
          icon={<NotebookPen size={32} color={colors.primary} />}
          title="A quiet month"
          message="Nothing was logged this month. Use the arrows to look at another month."
        />
        {reflectionCard}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {recap.moment ? <MomentsCard moment={recap.moment} /> : null}
      {reflectionCard}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <Stat
          icon={<NotebookPen color={colors.primary} size={18} />}
          tone="accentLavender"
          label="Diary entries"
          value={String(recap.entryCount)}
        />
        <Stat
          icon={<Wallet color={colors.primary} size={18} />}
          tone="accentButter"
          label="Spent"
          value={formatPaise(recap.spentPaise)}
          detail={recap.spendCount ? `${recap.spendCount} ${recap.spendCount === 1 ? 'expense' : 'expenses'}` : null}
        />
        <Stat
          icon={<Sprout color={colors.success} size={18} />}
          tone="accentSage"
          label="Habits done"
          value={String(recap.habitCompletions)}
          detail="times"
        />
        <Stat
          icon={<Droplets color={colors.info} size={18} />}
          tone="accentBlue"
          label="Water, daily average"
          value={recap.waterDays ? formatMl(recap.avgWaterMl) : '—'}
          detail={recap.waterDays ? `${recap.waterDays} ${recap.waterDays === 1 ? 'day' : 'days'} logged` : null}
        />
      </View>

      <MoodBars recap={recap} />

      {recap.weightNote ? (
        <Card accessible accessibilityLabel={recap.weightNote}>
          <AppText>{recap.weightNote}</AppText>
        </Card>
      ) : null}
    </View>
  );
}
