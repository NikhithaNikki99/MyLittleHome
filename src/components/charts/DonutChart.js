import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

// `segments`: [{ key, value, color }] with value > 0. Draws arcs proportional to value; children render in the hole.
export function DonutChart({ segments, size = 200, strokeWidth = 28, children }) {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {total > 0 &&
          segments.map((s) => {
            const length = (s.value / total) * circumference;
            const circle = (
              <Circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={s.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
              />
            );
            offset += length;
            return circle;
          })}
      </Svg>
      {children}
    </View>
  );
}
