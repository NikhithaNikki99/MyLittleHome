import { create } from 'zustand';

// Cache of the last dashboard read from SQLite. Never written to directly by screens:
// changes go through features/dashboard/dashboardActions, which write to SQLite and then reload.
export const useDashboardStore = create((set) => ({
  data: null,
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  error: null,
  setLoading: () => set((s) => ({ status: s.data ? s.status : 'loading', error: null })),
  setData: (data) => set({ data, status: 'ready', error: null }),
  setError: (error) => set({ status: 'error', error }),
}));
