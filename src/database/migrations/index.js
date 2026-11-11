import m001 from './001_app_settings';
import m002 from './002_wellness_core';
import m003 from './003_expenses_core';
import m004 from './004_habits_core';
import m005 from './005_tasks_core';
import m006 from './006_diary';
import m007 from './007_budgets_savings';
import m008 from './008_sleep';
import m009 from './009_goals';

// Append new migrations to the end. Never edit or reorder a migration that has shipped:
// versions must be unique, ascending, and contiguous from 1.
export const migrations = [m001, m002, m003, m004, m005, m006, m007, m008, m009];
