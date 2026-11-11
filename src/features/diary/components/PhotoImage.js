import { ImageOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';

// Shows a stored photo, or a quiet placeholder when there is no file to show
// (for example after restoring a backup on a new phone, or if the file was removed).
export function PhotoImage({ uri, style, iconSize = 28, accessibilityLabel }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View
        accessible={Boolean(accessibilityLabel)}
        accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} unavailable` : undefined}
        style={[{ backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        <ImageOff color={colors.textMuted} size={iconSize} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailed(true)}
    />
  );
}
