import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeProvider';

// Small line chart of weight over time. `points`: oldest first, [{ key, kg }].
// Decorative for screen readers: the numbers are always in the text beside it (`summary`).
export function WeightChart({ points, goalKg = null, height = 120, width = 300, summary }) {
  const { colors } = useTheme();
  if (points.length < 2) return null;

  const padX = 12;
  const padY = 14;
  const values = points.map((p) => p.kg).concat(goalKg !== null ? [goalKg] : []);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i) => padX + (i * (width - padX * 2)) / (points.length - 1);
  const y = (kg) => padY + (1 - (kg - lo) / span) * (height - padY * 2);
  const line = points.map((p, i) => `${x(i)},${y(p.kg)}`).join(' ');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {goalKg !== null ? (
          <Line
            x1={padX}
            x2={width - padX}
            y1={y(goalKg)}
            y2={y(goalKg)}
            stroke={colors.textMuted}
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
        ) : null}
        <Polyline
          points={line}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <Circle key={p.key} cx={x(i)} cy={y(p.kg)} r={i === points.length - 1 ? 5 : 3} fill={colors.primary} />
        ))}
      </Svg>
    </View>
  );
}
