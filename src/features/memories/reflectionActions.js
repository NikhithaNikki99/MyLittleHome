import { getDatabase } from '../../database/client';
import { deleteReflection, saveReflection } from './reflectionService';

export const reflectionActions = {
  save: async (monthKey, fields) => saveReflection(await getDatabase(), monthKey, fields),
  remove: async (monthKey) => deleteReflection(await getDatabase(), monthKey),
};
