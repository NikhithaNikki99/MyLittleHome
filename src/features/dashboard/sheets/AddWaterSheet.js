import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Chip } from '../../../components/common/Chip';
import { FormError } from '../../../components/common/FormError';
import { TextField } from '../../../components/common/TextField';
import { useTheme } from '../../../theme/ThemeProvider';
import { ValidationError } from '../../../utils/errors';
import { parseMl } from '../../../utils/units';
import { dashboardActions } from '../dashboardActions';
import { useSheetSubmit } from './useSheetSubmit';

const QUICK_AMOUNTS = [150, 250, 500];

export function AddWaterSheet({ visible, onClose }) {
  const { spacing } = useTheme();
  const [custom, setCustom] = useState('');
  const { busy, error, setError, run } = useSheetSubmit(onClose);

  useEffect(() => {
    if (visible) {
      setCustom('');
      setError(null);
    }
  }, [visible, setError]);

  const addAmount = (ml) => run(() => dashboardActions.addWater(ml));

  const addCustom = () =>
    run(async () => {
      const ml = parseMl(custom);
      if (ml === null) throw new ValidationError('Enter whole millilitres, like 330.');
      await dashboardActions.addWater(ml);
    });

  return (
    <BottomSheet visible={visible} title="Log water" onClose={onClose}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="label">Quick add</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {QUICK_AMOUNTS.map((ml) => (
            <Chip key={ml} label={`${ml} ml`} onPress={() => addAmount(ml)} />
          ))}
        </View>
      </View>
      <TextField
        label="Or enter an amount (ml)"
        value={custom}
        onChangeText={setCustom}
        placeholder="330"
        keyboardType="number-pad"
      />
      <FormError message={error} />
      <Button title={busy ? 'Saving…' : 'Add water'} onPress={addCustom} disabled={busy || custom.trim() === ''} />
    </BottomSheet>
  );
}
