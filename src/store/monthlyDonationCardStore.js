import { create } from 'zustand';

const LOCAL_STORAGE_KEY = 'kmlwj_monthly_donation_cards';

const INITIAL_DEMO_CARDS = [
  {
    id: 'md-card-1',
    cardNumber: 'MD-2026-0001',
    name: 'MOHAMMAD IMRAN',
    fatherName: 'ABDUL REHMAN',
    cnic: '42301-1234567-1',
    mobile: '0300-1234567',
    address: 'Street 4, Sector 7, Lyari, Karachi',
    gham: 'LOHARWADA',
    amount: 8000,
    monthlyAmount: 8000,
    issueDate: '2026-01-15',
    category: 'MONTHLY_AID',
    recipientType: 'BENEFICIARY',
    status: 'ACTIVE',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'md-card-2',
    cardNumber: 'MD-2026-0002',
    name: 'BILAL AHMED',
    fatherName: 'MUHAMMAD TARIQ',
    cnic: '42301-9876543-3',
    mobile: '0321-7654321',
    address: 'House B-22, New Kalri, Lyari, Karachi',
    gham: 'LOHARWADA',
    amount: 10000,
    monthlyAmount: 10000,
    issueDate: '2026-02-01',
    category: 'MONTHLY_AID',
    recipientType: 'BENEFICIARY',
    status: 'ACTIVE',
    createdAt: '2026-02-01T11:30:00.000Z',
  },
  {
    id: 'md-card-3',
    cardNumber: 'MD-2026-0003',
    name: 'FATIMA BIBI',
    fatherName: 'W/O LATE GHULAM NABI',
    cnic: '42301-4455667-8',
    mobile: '0333-5566778',
    address: 'Block C, Gali 12, Lyari, Karachi',
    gham: 'LOHARWADA',
    amount: 6000,
    monthlyAmount: 6000,
    issueDate: '2026-02-10',
    category: 'MONTHLY_AID',
    recipientType: 'BENEFICIARY',
    status: 'ACTIVE',
    createdAt: '2026-02-10T14:15:00.000Z',
  },
];

function loadCards() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load monthly donation cards from localStorage', e);
  }
  return INITIAL_DEMO_CARDS;
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
      const cardNumber = `MD-2026-${String(nextNum).padStart(4, '0')}`;

      const newCard = {
        id: `md-card-${Date.now()}`,
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
