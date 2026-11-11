import { View } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { AppText } from '../../../components/common/AppText';

// Simple labelled bars. `data`: [{ key, label, value }] where value is a number or null (nothing
// logged). `max` fixes the scale; `goal` draws a thin marker. The whole chart is one accessible
// element described by `summary`, so screen readers get a sentence instead of seven bars.
export function BarChart({ data, max, goal = null, color, height = 110, summary }) {
  const { colors, spacing, radii } = useTheme();
  const scale = Math.max(max, 1);
  const goalPct = goal !== null ? Math.min(1, goal / scale) * 100 : null;

  return (
    <View accessible accessibilityLabel={summary} style={{ gap: spacing.xs }}>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        {goalPct !== null ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${goalPct}%`,
              borderTopWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.textMuted,
            }}
          />
        ) : null}
        {data.map((d) => {
          const pct = d.value === null ? 0 : Math.min(1, d.value / scale) * 100;
          return (
            <View key={d.key} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: d.value === null ? 0 : `${Math.max(pct, d.value > 0 ? 4 : 0)}%`,
                  borderRadius: radii.sm,
                  backgroundColor: color ?? colors.info,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {data.map((d) => (
          <AppText key={d.key} variant="caption" muted style={{ flex: 1, textAlign: 'center' }}>
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}
