import { create } from 'zustand';

export const useJournalStore = create((set, get) => ({
  journals: [],
  isLoading: false,
  error: null,

  fetchJournals: async (subsidiary = 'Global', page = 1, limit = 100) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/v1/journal-entries?subsidiary=${subsidiary}&page=${page}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to fetch journals');
      
      set({ journals: data.data, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  addJournalEntry: async (entry) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/v1/journal-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(entry)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to create journal entry');
      
      // Refresh the list after successful creation
      await get().fetchJournals(entry.subsidiary || 'Global');
      set({ isLoading: false });
      return { success: true, data: data.data };
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return { success: false, error: err.message };
    }
  },

  logActivity: () => {
    // Audit logs are now handled by the backend automatically
  },

  resetJournals: () => {
    set({ journals: [], error: null });
  },
}));
