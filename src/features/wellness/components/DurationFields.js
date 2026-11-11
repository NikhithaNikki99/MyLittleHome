import { View } from 'react-native';
import { TextField } from '../../../components/common/TextField';
import { useTheme } from '../../../theme/ThemeProvider';

// Hours + minutes as two number fields. Parsing lives in parseDuration (wellnessStats.js).
export function DurationFields({ hours, minutes, onHours, onMinutes }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <TextField label="Hours" value={hours} onChangeText={onHours} placeholder="7" keyboardType="number-pad" maxLength={2} />
      </View>
      <View style={{ flex: 1 }}>
        <TextField
          label="Minutes"
          value={minutes}
          onChangeText={onMinutes}
          placeholder="30"
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>
    </View>
  );
}
