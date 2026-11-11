import { ImagePlus, X } from 'lucide-react-native';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { useTheme } from '../../../theme/ThemeProvider';
import { MAX_PHOTOS } from '../diaryLogic';
import { PhotoImage } from './PhotoImage';

const TILE = 120;

// Horizontal strip of the entry's photos with an "add" tile. Photos are { key, uri }.
export function PhotoBanner({ photos, onAdd, onRemove, disabled = false }) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const full = photos.length >= MAX_PHOTOS;
  // With no photos the add tile spans the screen like a banner; afterwards it is a regular tile.
  const addWidth = photos.length === 0 ? screenWidth - spacing.lg * 2 : TILE;

  return (
    <View style={{ gap: spacing.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {photos.map((photo, index) => (
          <View key={photo.key} style={{ width: TILE, height: TILE }}>
            <PhotoImage
              uri={photo.uri}
              accessibilityLabel={`Photo ${index + 1} of ${photos.length}`}
              style={{ width: TILE, height: TILE, borderRadius: radii.md }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => onRemove(photo.key)}
              hitSlop={8}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <X color={colors.text} size={16} />
            </Pressable>
          </View>
        ))}
        {!full ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photos.length === 0 ? 'Add photos' : 'Add more photos'}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onAdd}
            style={({ pressed }) => ({
              width: addWidth,
              height: TILE,
              minHeight: touchTarget,
              borderRadius: radii.md,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.primary,
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
            })}
          >
            <ImagePlus color={colors.primary} size={28} />
            <AppText variant="label">Add photos</AppText>
          </Pressable>
        ) : null}
      </ScrollView>
      <AppText variant="caption" muted>
        {photos.length} of {MAX_PHOTOS} photos. They are copied into this app and stay on your device.
      </AppText>
    </View>
  );
}
