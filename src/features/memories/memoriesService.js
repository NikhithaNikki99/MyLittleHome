import {
  countEntriesInRange,
  expenseTotalInRange,
  habitCompletionsInRange,
  listOnThisDay,
  listPhotosForEntries,
  listTimelineEntries,
  moodDistributionInRange,
  pickMomentEntry,
  waterSummaryInRange,
  weightBoundsInRange,
} from '../../database/repositories/memoriesRepository';
import { monthKeyOf, monthRange } from '../../utils/dates';
import { getReflection } from './reflectionService';

const PREVIEW_CHARS = 120;

function preview(row) {
  const text = (row.content ?? '').trim().replace(/\s+/g, ' ');
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS).trimEnd()}…` : text;
}

function toEntry(row, photos) {
  return {
    id: row.id,
    title: row.title?.trim() || null,
    preview: preview(row),
    date: row.entry_date,
    mood: row.mood ?? null,
    favorite: row.is_favorite === 1,
    photos,
  };
}

// Entries grouped by 'YYYY-MM', newest first. Input rows must already be newest first.
export function groupByMonth(entries) {
  const groups = [];
  for (const entry of entries) {
    const key = monthKeyOf(entry.date);
    const last = groups[groups.length - 1];
    if (last && last.monthKey === key) last.entries.push(entry);
    else groups.push({ monthKey: key, entries: [entry] });
  }
  return groups;
}

export async function getTimeline(db, todayKey) {
  const rows = await listTimelineEntries(db);
  const photoRows = await listPhotosForEntries(db, rows.map((r) => r.id));
  const photosByEntry = new Map();
  for (const p of photoRows) {
    if (!photosByEntry.has(p.entry_id)) photosByEntry.set(p.entry_id, []);
    photosByEntry.get(p.entry_id).push({ id: p.id, uri: p.uri });
  }
  const entries = rows.map((r) => toEntry(r, photosByEntry.get(r.id) ?? []));
  const onThisDay = (await listOnThisDay(db, todayKey)).map((r) => toEntry(r, []));
  return { groups: groupByMonth(entries), onThisDay, total: entries.length };
}

// Neutral wording: the direction of weight change is reported, never judged.
export function describeWeightChange(first, last) {
  if (!first || !last) return null;
  // A single weigh-in has nothing to compare against.
  if (first.entry_date === last.entry_date && first.weight_kg === last.weight_kg) return null;
  const diff = Math.round((last.weight_kg - first.weight_kg) * 10) / 10;
  if (diff === 0) return 'Weight stayed about the same';
  return `Weight ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} kg across the month`;
}

export function averageWaterMl(totalMl, days) {
  return days > 0 ? Math.round(totalMl / days) : 0;
}

export async function getMonthRecap(db, monthKey) {
  const { start, endExclusive } = monthRange(`${monthKey}-01`);
  const [entryCount, moods, spend, habitDone, water, weight, momentRow, reflection] = await Promise.all([
    countEntriesInRange(db, start, endExclusive),
    moodDistributionInRange(db, start, endExclusive),
    expenseTotalInRange(db, start, endExclusive),
    habitCompletionsInRange(db, start, endExclusive),
    waterSummaryInRange(db, start, endExclusive),
    weightBoundsInRange(db, start, endExclusive),
    pickMomentEntry(db, start, endExclusive),
    getReflection(db, monthKey),
  ]);

  let moment = null;
  if (momentRow) {
    const photos = await listPhotosForEntries(db, [momentRow.id]);
    moment = toEntry(momentRow, photos.map((p) => ({ id: p.id, uri: p.uri })));
  }

  const moodCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const m of moods) moodCounts[m.mood] = m.n;
  const moodTotal = Object.values(moodCounts).reduce((a, b) => a + b, 0);

  return {
    monthKey,
    entryCount,
    moodCounts,
    moodTotal,
    spentPaise: spend.totalPaise,
    spendCount: spend.count,
    habitCompletions: habitDone,
    avgWaterMl: averageWaterMl(water.totalMl, water.days),
    waterDays: water.days,
    weightNote: describeWeightChange(weight.first, weight.last),
    moment,
    reflection,
    isEmpty:
      entryCount === 0 && moodTotal === 0 && spend.count === 0 && habitDone === 0 && water.days === 0 && !weight.first,
  };
}
