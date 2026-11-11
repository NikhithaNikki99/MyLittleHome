import {
  deleteReflectionRow,
  getReflectionRow,
  upsertReflectionRow,
} from '../../database/repositories/reflectionRepository';
import { monthKeyOf, nowIso, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { isValidMonthKey } from '../expenses/expenseMath';
import { MAX_REFLECTION_LENGTH, REFLECTION_FIELDS } from './reflectionOptions';

function requireMonth(monthKey, today) {
  if (!isValidMonthKey(monthKey)) throw new ValidationError('That month is not valid.');
  if (monthKey > monthKeyOf(today)) throw new ValidationError('You can reflect on a month once it has begun.');
}

function toReflection(row) {
  return {
    id: row.id,
    monthKey: row.month_key,
    wentWell: row.went_well,
    wasHard: row.was_hard,
    gratefulFor: row.grateful_for,
    intention: row.intention,
    updatedAt: row.updated_at,
  };
}

export async function getReflection(db, monthKey) {
  const row = await getReflectionRow(db, monthKey);
  return row ? toReflection(row) : null;
}

// Text is trimmed at both ends; boxes left empty are stored as nothing. At least one box needs words.
export async function saveReflection(db, monthKey, fields, { today = toDateKey() } = {}) {
  requireMonth(monthKey, today);
  const clean = {};
  for (const { key, label } of REFLECTION_FIELDS) {
    const value = fields?.[key];
    if (value !== undefined && value !== null && typeof value !== 'string') throw new ValidationError('That text is not valid.');
    const text = (value ?? '').trim();
    if (text.length > MAX_REFLECTION_LENGTH) {
      throw new ValidationError(`Keep "${label}" under ${MAX_REFLECTION_LENGTH} characters.`);
    }
    clean[key] = text === '' ? null : text;
  }
  if (Object.values(clean).every((v) => v === null)) throw new ValidationError('Write a few words in at least one box.');

  await upsertReflectionRow(db, { id: newId(), monthKey, ...clean, nowIso: nowIso() });
}

export async function deleteReflection(db, monthKey) {
  const changes = await deleteReflectionRow(db, monthKey);
  if (changes === 0) throw new ValidationError('There is no reflection for that month.');
}
