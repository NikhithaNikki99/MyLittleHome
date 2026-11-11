import { Stack } from 'expo-router';

// Opening /diary/new or /diary/<id> directly (for example from Home) still has the list underneath,
// so Back lands on the Diary list.
export const unstable_settings = { initialRouteName: 'index' };

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
