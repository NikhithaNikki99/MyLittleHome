import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { EntryForm } from './EntryForm';
import { diaryActions } from './diaryActions';
import { blankEntry } from './diaryLogic';

export default function NewEntryScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams();
  const [initial] = useState(() => blankEntry(date));

  return (
    <EntryForm
      heading="New Entry"
      initial={initial}
      submitLabel="Save entry"
      onSave={diaryActions.create}
      onSaved={(id) => router.replace(`/diary/${id}`)}
    />
  );
}
