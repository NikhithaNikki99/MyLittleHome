import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// `progress` 0..1 (clamped). Decorative: put the numbers in nearby text for screen readers.
export function ProgressBar({ progress, color, height = 8 }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * 100;
  return (
    <View
      accessible={false}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}
    >
      <View
        style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: color ?? colors.primary }}
      />
    </View>
  );
}
