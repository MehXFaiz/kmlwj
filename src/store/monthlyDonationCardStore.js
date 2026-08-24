import { create } from 'zustand';

const LOCAL_STORAGE_KEY = 'kmlwj_monthly_donation_cards';

function loadCards() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Filter out legacy demo records if present
        return parsed.filter(c => !['md-card-1', 'md-card-2', 'md-card-3'].includes(c.id));
      }
    }
  } catch (e) {
    console.error('Failed to load monthly donation cards from localStorage', e);
  }
  return [];
}

function saveCards(cards) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {
    console.error('Failed to save monthly donation cards', e);
  }
}

export const useMonthlyDonationCardStore = create((set, get) => ({
  cards: loadCards(),
  loading: false,
  error: null,

  fetchCards: async () => {
    set({ loading: true, error: null });
    try {
      const cards = loadCards();
      set({ cards, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  issueCard: async (data) => {
    set({ loading: true, error: null });
    try {
      const existing = get().cards;
      const nextNum = existing.length + 1;
      const cardNumber = `MFS-2026-${String(nextNum).padStart(4, '0')}`;

      const newCard = {
        id: `mfs-card-${Date.now()}`,
        cardNumber: data.cardNumber || cardNumber,
        name: (data.name || '').toUpperCase(),
        fatherName: data.fatherName || '—',
        cnic: data.cnic || '—',
        mobile: data.mobile || '—',
        address: data.address || 'Lyari, Karachi',
        gham: data.gham || 'LOHARWADA',
        amount: Number(data.amount || data.monthlyAmount || 5000),
        monthlyAmount: Number(data.amount || data.monthlyAmount || 5000),
        issueDate: data.issueDate || new Date().toISOString().slice(0, 10),
        photoUrl: data.photoUrl || null,
        recipientType: data.recipientType || 'BENEFICIARY',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      const updated = [newCard, ...existing];
      saveCards(updated);
      set({ cards: updated, loading: false });
      return newCard;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deleteCard: async (id) => {
    set({ loading: true, error: null });
    try {
      const filtered = get().cards.filter(c => c.id !== id);
      saveCards(filtered);
      set({ cards: filtered, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
