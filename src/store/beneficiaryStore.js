import { create } from 'zustand';
import { beneficiaryService } from '../services/beneficiaryService';

const INITIAL_BENEFICIARIES = [
  { id: 'ben-1', name: 'Abdul Rehman', cnic: '42101-1234567-1', mobile: '0300-1112233', address: 'Plot 12, Block 4, Gulshan-e-Iqbal, Karachi', remarks: 'Monthly ration support', isActive: true },
  { id: 'ben-2', name: 'Fatima Bibi', cnic: '42201-9876543-2', mobile: '0312-4455667', address: 'House 45, Sector 11-B, North Karachi', remarks: 'Widow stipend & medical aid', isActive: true },
  { id: 'ben-3', name: 'Muhammad Tariq', cnic: '42301-5544332-3', mobile: '0333-9988776', address: 'Flat 302, Al-Noor Heights, Federal B Area', remarks: 'Child tuition fee assistance', isActive: true },
  { id: 'ben-4', name: 'Zainab Mai', cnic: '42401-6677889-4', mobile: '0345-2233445', address: 'Street 7, Orangi Town Sector 4', remarks: 'Emergency medical treatment', isActive: true },
  { id: 'ben-5', name: 'Rashid Ahmed', cnic: '42501-3322110-5', mobile: '0321-7788990', address: 'House 18, Korangi No 2.5, Karachi', remarks: 'Small business rehabilitation grant', isActive: true }
];

const getStoredBeneficiaries = () => {
  try {
    const stored = localStorage.getItem('kmlwj_beneficiaries');
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Error reading stored beneficiaries:', e);
  }
  localStorage.setItem('kmlwj_beneficiaries', JSON.stringify(INITIAL_BENEFICIARIES));
  return INITIAL_BENEFICIARIES;
};

export const useBeneficiaryStore = create((set, get) => ({
  beneficiaries: [],
  loading: false,
  error: null,

  fetchBeneficiaries: async () => {
    set({ loading: true });
    try {
      const data = await beneficiaryService.getAll();
      const list = (data && data.data && data.data.length > 0) ? data.data : getStoredBeneficiaries();
      set({ beneficiaries: list, loading: false, error: null });
    } catch (err) {
      const fallbackList = getStoredBeneficiaries();
      set({ beneficiaries: fallbackList, loading: false, error: null });
    }
  },

  addBeneficiary: async (data) => {
    try {
      await beneficiaryService.create(data);
      await get().fetchBeneficiaries();
    } catch (err) {
      // Fallback to local storage
      const current = getStoredBeneficiaries();
      const newItem = {
        id: `ben-${Date.now()}`,
        name: data.name || '',
        cnic: data.cnic || null,
        mobile: data.mobile || null,
        address: data.address || null,
        remarks: data.remarks || null,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
        createdAt: new Date().toISOString()
      };
      const updated = [newItem, ...current];
      localStorage.setItem('kmlwj_beneficiaries', JSON.stringify(updated));
      set({ beneficiaries: updated, error: null });
    }
  },

  updateBeneficiary: async (id, data) => {
    try {
      await beneficiaryService.update(id, data);
      await get().fetchBeneficiaries();
    } catch (err) {
      const current = getStoredBeneficiaries();
      const updated = current.map(b => b.id === id ? { ...b, ...data } : b);
      localStorage.setItem('kmlwj_beneficiaries', JSON.stringify(updated));
      set({ beneficiaries: updated, error: null });
    }
  },

  deleteBeneficiary: async (id) => {
    try {
      await beneficiaryService.delete(id);
      await get().fetchBeneficiaries();
    } catch (err) {
      const current = getStoredBeneficiaries();
      const updated = current.filter(b => b.id !== id);
      localStorage.setItem('kmlwj_beneficiaries', JSON.stringify(updated));
      set({ beneficiaries: updated, error: null });
    }
  }
}));
