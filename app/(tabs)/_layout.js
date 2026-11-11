import { Tabs } from 'expo-router/js-tabs';
import { BookHeart, CalendarDays, Ellipsis, House, Sprout } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';

// Folder-backed tabs (diary, trackers, planner, profile) each own a nested Stack in their _layout.js,
// so sub-screens open inside the tab and the tab bar stays visible.
const TABS = [
  { name: 'index', title: 'Home', Icon: House },
  { name: 'diary', title: 'Diary', Icon: BookHeart },
  { name: 'trackers', title: 'Track', Icon: Sprout },
  { name: 'planner', title: 'Planner', Icon: CalendarDays },
  { name: 'profile', title: 'More', Icon: Ellipsis },
];

export default function TabsLayout() {
  const { colors, typography } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: typography.caption.fontSize, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 64,
          paddingTop: 6,
        },
      }}
    >
      {TABS.map(({ name, title, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarAccessibilityLabel: `${title} tab`,
            tabBarIcon: ({ color, focused, size }) => (
              <Icon color={color} size={size} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
