import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from './AppText';

export function BottomSheet({ visible, title, onClose, children }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radii } = theme;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          style={{ ...StyleAbsoluteFill, backgroundColor: 'rgba(40, 25, 30, 0.45)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '88%',
            backgroundColor: colors.background,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: spacing.md,
            }}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}
          >
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const StyleAbsoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
