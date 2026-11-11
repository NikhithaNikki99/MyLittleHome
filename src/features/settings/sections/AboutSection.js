import Constants from 'expo-constants';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { Card } from '../../../components/common/Card';
import { useTheme } from '../../../theme/ThemeProvider';

const FACTS = [
  ['Where your data lives', 'In a database on this phone. Photos are copied into the app\'s private storage.'],
  ['Internet', 'The app does not send your data anywhere. It has no account and no sign-in.'],
  ['Your PIN', 'Only a scrambled (hashed) version is kept, in the phone\'s secure storage. It is not in your backups.'],
  ['Backups', 'Backup files are plain, readable files. Keep them somewhere you trust.'],
];

const LIMITS = [
  'The database is not encrypted. The app lock keeps the app closed, but the data is not scrambled on the phone.',
  'Android may back up app data to your Google account if your phone has that turned on. Check your phone\'s backup settings if that matters to you.',
  'If you uninstall the app or clear its data, your diary is gone unless you made a backup.',
  'This app is for personal journaling and tracking. It is not medical advice.',
];

export function AboutSection() {
  const { spacing } = useTheme();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <Card style={{ gap: spacing.md }}>
      <AppText variant="heading" accessibilityRole="header">
        About My Little World
      </AppText>
      <AppText muted>Version {version}</AppText>
      <AppText>A small, private place for your diary, spending, habits and days. It works fully offline.</AppText>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">What is stored where</AppText>
        {FACTS.map(([title, text]) => (
          <View key={title}>
            <AppText variant="label">{title}</AppText>
            <AppText variant="caption" muted>
              {text}
            </AppText>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">Good to know</AppText>
        {LIMITS.map((text) => (
          <AppText key={text} variant="caption" muted>
            • {text}
          </AppText>
        ))}
      </View>
    </Card>
  );
}
