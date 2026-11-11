import { Alert } from 'react-native';

// Native confirmation for permanent deletes. Cancel is the default, safe choice.
export function confirmDelete({ title, message, confirmLabel = 'Delete' }, onConfirm) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
