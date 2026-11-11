import { toDateKey, isValidDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';

export const MAX_PHOTOS = 6;
export const MAX_TITLE_LENGTH = 120;
export const MAX_CONTENT_LENGTH = 20000;
export const MAX_TAG_LENGTH = 24;
export const MAX_TAGS_PER_ENTRY = 10;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const pad = (n) => String(n).padStart(2, '0');

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function currentTime(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// '09:05' -> '9:05 am'. Falls back to the raw value if it is not HH:MM.
export function formatTime12(time) {
  if (!isValidTime(time)) return time ?? '';
  const hour = Number(time.slice(0, 2));
  const suffix = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${time.slice(3)} ${suffix}`;
}

// 'HH:MM' (24-hour, as stored) <-> the 12-hour parts the time picker edits.
export function splitTime(time) {
  const valid = isValidTime(time) ? time : currentTime();
  const hour = Number(valid.slice(0, 2));
  return { hour12: hour % 12 === 0 ? 12 : hour % 12, minute: Number(valid.slice(3)), isPm: hour >= 12 };
}

// Returns 'HH:MM', or null when the typed hour (1-12) or minute (0-59) is not a whole number in range.
export function buildTime(hourText, minuteText, isPm) {
  const hour = /^\d{1,2}$/.test(String(hourText).trim()) ? Number(hourText) : NaN;
  const minute = /^\d{1,2}$/.test(String(minuteText).trim()) ? Number(minuteText) : NaN;
  if (!(hour >= 1 && hour <= 12) || !(minute >= 0 && minute <= 59)) return null;
  const hour24 = (hour % 12) + (isPm ? 12 : 0);
  return `${pad(hour24)}:${pad(minute)}`;
}

// `date` pre-fills the entry date (e.g. the day picked on the calendar); anything invalid means today.
export function blankEntry(date) {
  return {
    title: '',
    content: '',
    entryDate: typeof date === 'string' && isValidDateKey(date) ? date : toDateKey(),
    entryTime: currentTime(),
    mood: null,
    isFavorite: false,
    tagNames: [],
    photos: [],
  };
}

export function cleanTagName(name) {
  return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
}

// Escapes LIKE wildcards so a search for "100%" or "a_b" matches those characters literally.
// Pair with `ESCAPE '\'` in the SQL.
export function escapeLike(term) {
  return term.replace(/[\\%_]/g, '\\$&');
}

const DERIVED_TITLE_MAX = 60;

// Splits an entry into what to show as its heading and what to show as its body.
// Without a title, a short first line becomes the heading and is not repeated in the body.
// A long first line is only shortened for the heading, and stays whole in the body so no text is hidden.
export function splitTitle(entry) {
  const content = (entry.content ?? '').trim();
  const title = entry.title?.trim();
  if (title) return { title, body: content };
  const lines = content.split('\n');
  const index = lines.findIndex((line) => line.trim().length > 0);
  if (index === -1) return { title: 'Untitled', body: '' };
  const first = lines[index].trim();
  if (first.length > DERIVED_TITLE_MAX) return { title: `${first.slice(0, DERIVED_TITLE_MAX - 3)}...`, body: content };
  return { title: first, body: lines.slice(index + 1).join('\n').trim() };
}

export function displayTitle(entry) {
  return splitTitle(entry).title;
}

export function toSnippet(content) {
  return (content ?? '').replace(/\s+/g, ' ').trim();
}

function positiveInt(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

// Validates and normalises form input. Throws ValidationError with a user-safe message.
// `photos` entries are either { id } (already saved on this entry) or { uri, width?, height? } (new).
export function normalizeEntryInput(input) {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const content = typeof input?.content === 'string' ? input.content.trim() : '';

  if (!title && !content) throw new ValidationError('Write a title or a few words first.');
  if (title.length > MAX_TITLE_LENGTH) throw new ValidationError(`Keep the title under ${MAX_TITLE_LENGTH} characters.`);
  if (content.length > MAX_CONTENT_LENGTH) throw new ValidationError('That entry is too long to save. Try splitting it in two.');

  const entryDate = input.entryDate ?? toDateKey();
  if (!isValidDateKey(entryDate)) throw new ValidationError('That date is not valid.');

  const entryTime = input.entryTime ?? currentTime();
  if (!isValidTime(entryTime)) throw new ValidationError('That time is not valid. Use 24-hour HH:MM.');

  const mood = input.mood ?? null;
  if (mood !== null && (!Number.isInteger(mood) || mood < 1 || mood > 5)) {
    throw new ValidationError('Pick a mood from the list.');
  }

  const photoInput = Array.isArray(input.photos) ? input.photos : [];
  if (photoInput.length > MAX_PHOTOS) throw new ValidationError(`You can add up to ${MAX_PHOTOS} photos.`);
  const photos = photoInput.map((p) => {
    if (p && typeof p.id === 'string' && p.id) return { id: p.id };
    if (p && typeof p.uri === 'string' && p.uri) {
      return { uri: p.uri, width: positiveInt(p.width), height: positiveInt(p.height) };
    }
    throw new ValidationError('One of the photos could not be read.');
  });

  const seen = new Set();
  const tagNames = [];
  for (const raw of Array.isArray(input.tagNames) ? input.tagNames : []) {
    const name = cleanTagName(raw);
    if (!name) continue;
    if (name.length > MAX_TAG_LENGTH) throw new ValidationError(`Tag names can be up to ${MAX_TAG_LENGTH} characters.`);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tagNames.push(name);
  }
  if (tagNames.length > MAX_TAGS_PER_ENTRY) throw new ValidationError(`Use up to ${MAX_TAGS_PER_ENTRY} tags per entry.`);

  return {
    title: title || null,
    content,
    entryDate,
    entryTime,
    mood,
    isFavorite: Boolean(input.isFavorite),
    tagNames,
    photos,
  };
}
