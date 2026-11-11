import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { CalendarMonth } from '../../../components/common/CalendarMonth';
import { Chip } from '../../../components/common/Chip';
import { FormError } from '../../../components/common/FormError';
import { MonthSwitcher } from '../../../components/common/MonthSwitcher';
import { TextField } from '../../../components/common/TextField';
import { useTheme } from '../../../theme/ThemeProvider';
import { monthKeyOf } from '../../../utils/dates';
import { buildTime, splitTime } from '../diaryLogic';

// No native date/time picker package is installed, so these are small in-app pickers.

export function DateSheet({ visible, value, onPick, onClose }) {
  const [monthKey, setMonthKey] = useState(monthKeyOf(value));

  useEffect(() => {
    if (visible) setMonthKey(monthKeyOf(value));
  }, [visible, value]);

  return (
    <BottomSheet visible={visible} title="Choose a date" onClose={onClose}>
      <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />
      <CalendarMonth
        monthKey={monthKey}
        selectedDate={value}
        onSelect={(key) => {
          onPick(key);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

export function TimeSheet({ visible, value, onPick, onClose }) {
  const { spacing } = useTheme();
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [isPm, setIsPm] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    const parts = splitTime(value);
    setHour(String(parts.hour12));
    setMinute(String(parts.minute).padStart(2, '0'));
    setIsPm(parts.isPm);
    setError(null);
  }, [visible, value]);

  const apply = () => {
    const time = buildTime(hour, minute, isPm);
    if (!time) {
      setError('Enter an hour from 1 to 12 and minutes from 00 to 59.');
      return;
    }
    onPick(time);
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="Choose a time" onClose={onClose}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Hour"
            value={hour}
            onChangeText={setHour}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="9"
          />
        </View>
        <AppText variant="title" style={{ paddingBottom: spacing.sm }}>
          :
        </AppText>
        <View style={{ flex: 1 }}>
          <TextField
            label="Minutes"
            value={minute}
            onChangeText={setMinute}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="30"
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="am" selected={!isPm} onPress={() => setIsPm(false)} accessibilityLabel="AM" />
        <Chip label="pm" selected={isPm} onPress={() => setIsPm(true)} accessibilityLabel="PM" />
      </View>
      <FormError message={error} />
      <Button title="Set time" onPress={apply} />
    </BottomSheet>
  );
}
