import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { FADE_MS, remainingMs, shouldHide } from './splashTiming';

// The supplied splash picture (assets/splash-screen.png), shown unedited and full-screen over the app while it
// loads. Android's own splash can only show a small centred icon, so it is kept to a plain sky-blue screen and
// this overlay carries the picture. `appReady` turns true once fonts and the database are ready.
// pointerEvents="none" while fading means a tap is never swallowed by a picture that is on its way out.
const SPLASH_SOURCE = require('../../../assets/splash-screen.png');

// React Native gives a bundled image its pixel size as width and height, which beat absoluteFill's insets; 100% overrides them.
const PICTURE_STYLE = { width: '100%', height: '100%', resizeMode: 'cover' };

export function SplashOverlay({ appReady }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const shownAt = useRef(null);
  const [gone, setGone] = useState(false);
  const fading = useRef(false);

  const startFade = () => {
    if (fading.current) return;
    fading.current = true;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => setGone(true));
  };

  // Called when the picture has actually been drawn: only then is the native splash taken away, so there is
  // never a moment with neither on screen.
  const onLoaded = () => {
    if (shownAt.current == null) shownAt.current = Date.now();
    SplashScreen.hideAsync().catch(() => {});
  };

  useEffect(() => {
    if (gone) return undefined;
    const tick = () => {
      if (shownAt.current == null) return;
      const now = Date.now();
      if (shouldHide({ shownAt: shownAt.current, now, appReady })) startFade();
    };
    tick();
    const wait = shownAt.current == null ? 100 : Math.max(50, remainingMs({ shownAt: shownAt.current, now: Date.now(), appReady }));
    const id = setInterval(tick, Math.min(wait, 250));
    return () => clearInterval(id);
  }, [appReady, gone]);

  if (gone) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      <Image source={SPLASH_SOURCE} onLoad={onLoaded} style={PICTURE_STYLE} fadeDuration={0} />
    </Animated.View>
  );
}
