import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// `progress` is 0..1 (clamped). Animates unless the user prefers reduced motion.
export function ProgressRing({ progress, size = 72, strokeWidth = 8, color, trackColor, children }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  const value = useSharedValue(reduceMotion ? target : 0);
  useEffect(() => {
    value.value = reduceMotion ? target : withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [target, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? colors.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? colors.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}
