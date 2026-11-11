import * as Haptics from 'expo-haptics';
import { BookHeart, Droplets, Scale, Wallet } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../common/AppText';

export function QuickActions({ onExpense, onDiary, onWeight, onWater }) {
  const { colors, spacing, radii } = useTheme();
  const actions = [
    { key: 'expense', label: 'Expense', Icon: Wallet, tone: 'accentPink', onPress: onExpense },
    { key: 'diary', label: 'Diary', Icon: BookHeart, tone: 'accentLavender', onPress: onDiary },
    { key: 'weight', label: 'Weight', Icon: Scale, tone: 'accentBlue', onPress: onWeight },
    { key: 'water', label: 'Water', Icon: Droplets, tone: 'accentSage', onPress: onWater },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {actions.map(({ key, label, Icon, tone, onPress }) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label.toLowerCase()}`}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onPress();
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 68,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            borderRadius: radii.md,
            backgroundColor: colors[tone],
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Icon color={colors.text} size={22} />
          <AppText variant="caption" style={{ fontWeight: '600' }}>
            {label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
