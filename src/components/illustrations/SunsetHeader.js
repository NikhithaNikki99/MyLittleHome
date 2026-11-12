import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { STARS, SCENES, bodyPosition, periodForHour } from './timeOfDay';

// Soft pastel landscape with a sun or moon, a hill and a few trees, drawn in SVG so it works offline. The sky, the
// light and the position of the sun or moon follow the hour (see timeOfDay.js). Decorative only: hidden from screen
// readers. Fades into the page at the bottom.
export function SunsetHeader({ width, height = 180, fadeTo = '#FDEEF1', date = new Date() }) {
  const hour = date.getHours();
  const scene = SCENES[periodForHour(hour)];
  const body = bodyPosition(hour, date.getMinutes());
  const [skyTop, skyMid, skyBottom] = scene.sky;

  return (
    <Svg width={width} height={height} viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" accessible={false}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={skyTop} />
          <Stop offset="0.55" stopColor={skyMid} />
          <Stop offset="1" stopColor={skyBottom} />
        </LinearGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={fadeTo} stopOpacity="0" />
          <Stop offset="1" stopColor={fadeTo} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="400" height="180" fill="url(#sky)" />
      {scene.stars
        ? STARS.map(([x, y, r]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#FFFFFF" opacity="0.85" />)
        : null}
      <Circle cx={body.x} cy={body.y} r={scene.sun.radius} fill={scene.sun.color} opacity={scene.sun.opacity} />
      <Path
        d="M0 120 C60 98 120 110 180 104 C250 96 320 112 400 100 L400 180 L0 180 Z"
        fill={scene.hillFar.color}
        opacity={scene.hillFar.opacity}
      />
      <Path
        d="M0 140 C70 124 140 134 210 128 C280 122 340 136 400 126 L400 180 L0 180 Z"
        fill={scene.hillNear.color}
        opacity={scene.hillNear.opacity}
      />
      <Path
        d="M318 126 l10 -34 l10 34 z M338 126 l8 -26 l8 26 z M356 128 l7 -22 l7 22 z"
        fill={scene.trees.color}
        opacity={scene.trees.opacity}
      />
      <Path d="M30 138 l8 -26 l8 26 z M48 140 l6 -18 l6 18 z" fill={scene.trees.color} opacity={scene.trees.opacity - 0.15} />
      <Rect x="0" y="100" width="400" height="80" fill="url(#fade)" />
    </Svg>
  );
}
