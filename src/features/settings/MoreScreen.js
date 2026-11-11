import { useRouter } from 'expo-router';
import { Heart, Images, Info, Settings } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Card } from '../../components/common/Card';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Divider, SettingsRow } from './components/SettingsRow';

// First letter of the name for the avatar, or a heart when no name is set.
export function avatarInitial(name) {
  const first = typeof name === 'string' ? Array.from(name.trim())[0] : null;
  return first ? first.toUpperCase() : null;
}

function ProfileCard({ onPress }) {
  const { colors, spacing } = useTheme();
  const name = useSettingsStore((s) => s.profileName);
  const initial = avatarInitial(name);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name ? `Your profile, ${name}. Edit` : 'Your profile. Add your name'}
      onPress={onPress}
    >
      <Card tone="accentPink" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View
          accessible={false}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.primary,
          }}
        >
          {initial ? (
            <AppText variant="title" color={colors.primary}>
              {initial}
            </AppText>
          ) : (
            <Heart color={colors.primary} size={26} fill={colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{name || 'Your name'}</AppText>
          <AppText variant="caption" muted>
            {name ? 'Tap to edit your profile' : 'Tap to add your name'}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const icon = (Icon) => <Icon color={colors.text} size={22} />;

  return (
    <Screen>
      <ScreenHeader title="More" />
      <ProfileCard onPress={() => router.push('/profile/settings')} />
      <Card style={{ paddingVertical: 8 }}>
        <SettingsRow
          icon={icon(Images)}
          tone="accentLavender"
          title="Memories"
          detail="Your timeline and monthly recap"
          onPress={() => router.push('/profile/memories')}
        />
        <Divider />
        <SettingsRow
          icon={icon(Settings)}
          tone="accentButter"
          title="Settings"
          detail="Profile, app lock, theme, reminders, backup"
          onPress={() => router.push('/profile/settings')}
        />
        <Divider />
        <SettingsRow
          icon={icon(Info)}
          tone="accentBlue"
          title="About"
          detail="Where your data lives and its limits"
          onPress={() => router.push('/profile/settings')}
        />
      </Card>
    </Screen>
  );
}
