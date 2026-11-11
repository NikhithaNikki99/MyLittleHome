import { refreshDashboard } from '../dashboard/dashboardActions';
import { loadSettingsIntoStore } from './settingsService';

// After a restore SQLite holds new data, so the in-memory caches (theme, name, Home) must be re-read.
export async function refreshAfterRestore() {
  await loadSettingsIntoStore();
  await refreshDashboard();
}
