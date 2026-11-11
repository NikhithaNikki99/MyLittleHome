import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Soft pastel sunset with a hill and a few trees, drawn in SVG so it works offline.
// Decorative only: hidden from screen readers. Fades into the page at the bottom.
export function SunsetHeader({ width, height = 180, fadeTo = '#FDEEF1' }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" accessible={false}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F4B9C6" />
          <Stop offset="0.55" stopColor="#F9D5C8" />
          <Stop offset="1" stopColor="#FCE6D2" />
        </LinearGradient>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={fadeTo} stopOpacity="0" />
          <Stop offset="1" stopColor={fadeTo} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="400" height="180" fill="url(#sky)" />
      <Circle cx="270" cy="92" r="30" fill="#FBE3B5" opacity="0.9" />
      <Path d="M0 120 C60 98 120 110 180 104 C250 96 320 112 400 100 L400 180 L0 180 Z" fill="#E9A9B6" opacity="0.7" />
      <Path d="M0 140 C70 124 140 134 210 128 C280 122 340 136 400 126 L400 180 L0 180 Z" fill="#D58BA0" opacity="0.8" />
      <Path d="M318 126 l10 -34 l10 34 z M338 126 l8 -26 l8 26 z M356 128 l7 -22 l7 22 z" fill="#8FAF8C" opacity="0.85" />
      <Path d="M30 138 l8 -26 l8 26 z M48 140 l6 -18 l6 18 z" fill="#8FAF8C" opacity="0.7" />
      <Rect x="0" y="100" width="400" height="80" fill="url(#fade)" />
    </Svg>
  );
}
