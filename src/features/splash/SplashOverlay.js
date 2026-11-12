import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { EDGE_COLORS, fitSplash } from './splashLayout';
import { FADE_MS, remainingMs, shouldHide } from './splashTiming';

// The splash picture (assets/splash-screen.png), shown unedited over the app while it loads. Android's own splash can
// only show a small centred icon, so it is kept to a plain sky-coloured screen and this overlay carries the picture.
// `appReady` turns true once fonts and the database are ready.
// pointerEvents="none" while fading means a tap is never swallowed by a picture that is on its way out.
const SPLASH_SOURCE = require('../../../assets/splash-screen.png');

// The whole picture is fitted inside the screen and never cropped or stretched (see splashLayout.js). A screen of a
// different shape leaves bands, which are filled with the picture's own edge colours: the top half meets its top
// edge and the bottom half meets its bottom edge, so the bands read as a continuation of the sky and the clouds.
const HALF_STYLE = { flex: 1 };

export function SplashOverlay({ appReady }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const layout = fitSplash(screenWidth, screenHeight);
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
      <View style={StyleSheet.absoluteFill}>
        <View style={[HALF_STYLE, { backgroundColor: EDGE_COLORS.top }]} />
        <View style={[HALF_STYLE, { backgroundColor: EDGE_COLORS.bottom }]} />
      </View>
      <Image
        source={SPLASH_SOURCE}
        onLoad={onLoaded}
        fadeDuration={0}
        resizeMode="stretch"
        style={{ position: 'absolute', left: layout.left, top: layout.top, width: layout.width, height: layout.height }}
      />
    </Animated.View>
  );
}
