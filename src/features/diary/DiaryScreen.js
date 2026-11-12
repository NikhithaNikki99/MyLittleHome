import { useRouter } from 'expo-router';
import { BookHeart, Heart, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { CalendarMonth } from '../../components/common/CalendarMonth';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Fab } from '../../components/common/Fab';
import { MonthSwitcher } from '../../components/common/MonthSwitcher';
import { Screen } from '../../components/common/Screen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { TextField } from '../../components/common/TextField';
import { useTheme } from '../../theme/ThemeProvider';
import { formatLongDate, monthKeyOf, toDateKey } from '../../utils/dates';
import { EntryCard } from './components/EntryCard';
import { HeaderIconButton } from './components/HeaderIconButton';
import { LIST_LIMIT, useDiaryList } from './useDiaryList';

const SEARCH_DELAY_MS = 250;

export default function DiaryScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const [monthKey, setMonthKey] = useState(() => monthKeyOf(toDateKey()));
  const [date, setDate] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Wait for a pause in typing before querying.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchText.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const { status, entries, marks, reload } = useDiaryList({ monthKey, date, query, favoritesOnly });

  const filtering = Boolean(date) || query !== '' || favoritesOnly;
  const openNew = () => router.push(date ? { pathname: '/diary/new', params: { date } } : '/diary/new');

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchText('');
      setQuery('');
    }
    setSearchOpen(!searchOpen);
  };

  const clearFilters = () => {
    setDate(null);
    setSearchText('');
    setQuery('');
    setFavoritesOnly(false);
  };

  let sectionTitle = 'Recent Entries';
  if (date) sectionTitle = formatLongDate(date);
  else if (query) sectionTitle = 'Search results';
  else if (favoritesOnly) sectionTitle = 'Favourites';

  return (
    <Screen floating={<Fab label="Write a new diary entry" onPress={openNew} />}>
      <ScreenHeader
        title="Diary"
        trailing={
          <View style={{ flexDirection: 'row' }}>
            <HeaderIconButton Icon={Search} label={searchOpen ? 'Close search' : 'Search entries'} selected={searchOpen} onPress={toggleSearch} />
            <HeaderIconButton
              Icon={Heart}
              label={favoritesOnly ? 'Show all entries' : 'Show favourites only'}
              selected={favoritesOnly}
              filled
              onPress={() => setFavoritesOnly(!favoritesOnly)}
            />
          </View>
        }
      />

      {searchOpen ? (
        <TextField
          label="Search your diary"
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Title or words in an entry"
          returnKeyType="search"
          autoFocus
          maxLength={80}
        />
      ) : null}

      <Card style={{ gap: spacing.md }}>
        <MonthSwitcher
          monthKey={monthKey}
          onChange={(next) => {
            setMonthKey(next);
            setDate(null);
          }}
        />
        <CalendarMonth
          monthKey={monthKey}
          selectedDate={date}
          markedDates={marks}
          onSelect={(key) => setDate(key === date ? null : key)}
        />
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          {sectionTitle}
        </AppText>
        {filtering ? <Button title="Clear filters" variant="soft" onPress={clearFilters} /> : null}
      </View>

      {status === 'loading' && entries.length === 0 ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {status === 'error' ? (
        <Card style={{ gap: spacing.md }}>
          <AppText variant="heading">We couldn't load your diary</AppText>
          <AppText muted>Nothing has been changed or lost. Please try again.</AppText>
          <Button title="Try again" onPress={reload} />
        </Card>
      ) : null}

      {status === 'ready' && entries.length === 0 ? (
        <EmptyState
          icon={<BookHeart color={colors.primary} size={32} />}
          title={filtering ? 'Nothing matches yet' : 'Your diary is waiting'}
          message={
            filtering
              ? 'Try another day or search, or clear the filters.'
              : 'Write a few words whenever you like. Your diary stays on this device.'
          }
        />
      ) : null}

      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onPress={() => router.push(`/diary/${entry.id}`)} />
      ))}

      {entries.length >= LIST_LIMIT ? (
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          Showing your latest {LIST_LIMIT} entries. Pick a day or search to find older ones.
        </AppText>
      ) : null}
    </Screen>
  );
}
