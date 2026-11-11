import { ImageOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// A photo thumbnail, or a quiet placeholder when the file is missing (for example after a restore,
// since backups carry photo records but not the image files).
export function MemoryPhoto({ uri, style, accessibilityLabel }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View
        accessible
        accessibilityLabel={`${accessibilityLabel ?? 'Photo'} unavailable`}
        style={[{ backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        <ImageOff color={colors.textMuted} size={22} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      accessible
      accessibilityLabel={accessibilityLabel ?? 'Photo'}
      onError={() => setFailed(true)}
    />
  );
}
