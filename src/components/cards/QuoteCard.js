import { Quote } from 'lucide-react-native';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../common/AppText';
import { Card } from '../common/Card';

export function QuoteCard({ quote }) {
  const { colors, spacing } = useTheme();
  return (
    <Card
      tone="accentButter"
      style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.md }}
      accessible
      accessibilityLabel={`Today's quote: ${quote}`}
    >
      <Quote color={colors.primary} size={22} />
      <View style={{ flex: 1 }}>
        <AppText variant="body">{quote}</AppText>
      </View>
    </Card>
  );
}
