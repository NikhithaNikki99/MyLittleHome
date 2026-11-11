import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { AboutSection } from './sections/AboutSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { AppLockSection } from './sections/AppLockSection';
import { BackupSection } from './sections/BackupSection';
import { ExportSection } from './sections/ExportSection';
import { ProfileSection } from './sections/ProfileSection';
import { RemindersSection } from './sections/RemindersSection';

export default function SettingsScreen() {
  return (
    <Screen>
      <ScreenHeader title="Settings" back />
      <ProfileSection />
      <AppLockSection />
      <AppearanceSection />
      <RemindersSection />
      <BackupSection />
      <ExportSection />
      <AboutSection />
    </Screen>
  );
}
