import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useAddIncomeStore } from '../store/addIncomeStore';
import { useCoaStore } from '../store/coaStore';
import { useAuthStore } from '../store/authStore';
import { addIncomeService } from '../services/addIncomeService';
import { showToast } from '../components/ui/Toast';
import { isGenuineBankAccount } from '../utils/accountFilters';
import { Modal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';
import {
  TrendingUp,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Save,
  Plus,
  Building,
  DollarSign,
  Calendar,
  CreditCard,
  FileText,
  Paperclip,
  Tag,
  Loader2,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  List
} from 'lucide-react';
import { pageActionsClass } from '../components/common/responsive';

import { PhoneInput } from '../components/ui/PhoneInput';
import { CNICInput } from '../components/ui/CNICInput';

const OTHER_INCOME_TYPES = [
  'Coconuts',
  'Oil',
  'Battery',
  'Scraps',
  'Rabi-ul-Awal',
  'Qurbani Space',
  'Other'
];

export const AddIncomeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore((state) => state.user);
  const isAdminOrSuperAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';

  const {
    categories,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    createRecord,
    updateRecord,
    loading
  } = useAddIncomeStore();

  const { flatAccounts, fetchAccountsList } = useCoaStore();

  // Available categories without "Donation Income"
  const availableCategories = useMemo(() => {
    return categories.filter(c => c.name !== 'Donation Income');
  }, [categories]);

  // Form State
  const [form, setForm] = useState({
    categoryId: '',
    otherIncomeType: '',
    customOtherIncome: '',
    customCategoryName: '',
    payerName: '',
    fatherName: '',
    cnic: '',
    mobile: '',
    address: '',
    gham: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    bankAccountId: '',
    referenceNumber: '',
    remarks: '',
    attachmentUrl: ''
  });

  const [isDirty, setIsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingRecord, setFetchingRecord] = useState(false);

  // Attachment upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', accountId: '', isActive: true });
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchAccountsList();
  }, [fetchCategories, fetchAccountsList]);

  // Set default category when categories load
  useEffect(() => {
    if (availableCategories.length > 0 && !form.categoryId && !id) {
      setForm(prev => ({ ...prev, categoryId: availableCategories[0].id }));
    }
  }, [availableCategories, form.categoryId, id]);

  // Check category selections
  const selectedCategoryObj = useMemo(() => {
    if (form.categoryId === 'CUSTOM') return null;
    return availableCategories.find(c => String(c.id) === String(form.categoryId)) || null;
  }, [availableCategories, form.categoryId]);

  const isOtherIncomeSelected = useMemo(() => {
    return selectedCategoryObj?.name === 'Other Income';
  }, [selectedCategoryObj]);

  const isCustomCategorySelected = form.categoryId === 'CUSTOM';

  // Load existing record when editing
  useEffect(() => {
    if (id && availableCategories.length > 0) {
      setFetchingRecord(true);
      addIncomeService.getRecordById(id)
        .then((rec) => {
          if (rec) {
            const isOther = rec.category?.name === 'Other Income';
            const standardSub = rec.subCategory && OTHER_INCOME_TYPES.includes(rec.subCategory);

            let otherType = '';
            let customOtherText = '';
            let isCustomCat = false;
            let customCatText = '';

            if (isOther) {
              if (rec.subCategory) {
                if (standardSub && rec.subCategory !== 'Other') {
                  otherType = rec.subCategory;
                } else {
                  otherType = 'Other';
                  customOtherText = rec.subCategory;
                }
              }
            } else {
              const matchedCat = availableCategories.find(c => c.id === rec.categoryId || c.name === rec.category?.name);
              if (!matchedCat) {
                isCustomCat = true;
                customCatText = rec.category?.name || '';
              }
            }

            const catIdValue = isCustomCat ? 'CUSTOM' : (rec.categoryId || rec.category?.id || '');

            setForm({
              categoryId: catIdValue,
              otherIncomeType: otherType,
              customOtherIncome: customOtherText,
              customCategoryName: customCatText,
              amount: rec.amount ? String(rec.amount) : '',
              date: rec.date ? new Date(rec.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              paymentMethod: rec.paymentMethod || 'CASH',
              bankAccountId: rec.bankAccountId || '',
              referenceNumber: rec.referenceNumber || '',
              remarks: rec.remarks || '',
              attachmentUrl: rec.attachmentUrl || ''
            });
            setIsDirty(false);
          } else {
            showToast('Income record not found', 'error');
            navigate('/add-income/records');
          }
        })
        .catch((err) => {
          showToast(err.message || 'Failed to load record', 'error');
        })
        .finally(() => setFetchingRecord(false));
    }
  }, [id, availableCategories, navigate]);

  // Warn on unsaved changes when leaving
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Keyboard shortcut Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form]);

  // Filter Bank Accounts from CoA (only genuine active bank accounts)
  const bankAccounts = useMemo(() => {
    return flatAccounts.filter(isGenuineBankAccount);
  }, [flatAccounts]);

  // Display Name of Selected Category & Subcategory for Accounting Preview
  const displayCategoryName = useMemo(() => {
    if (isCustomCategorySelected) {
      return form.customCategoryName ? form.customCategoryName.trim() : 'Custom Income Category';
    }
    if (isOtherIncomeSelected) {
      if (form.otherIncomeType === 'Other') {
        return form.customOtherIncome ? `Other Income - ${form.customOtherIncome.trim()}` : 'Other Income';
      }
      if (form.otherIncomeType) {
        return `Other Income - ${form.otherIncomeType}`;
      }
      return 'Other Income';
    }
    return selectedCategoryObj?.name || 'Income Category';
  }, [isCustomCategorySelected, isOtherIncomeSelected, form.customCategoryName, form.otherIncomeType, form.customOtherIncome, selectedCategoryObj]);

  // Mapped GL Account
  const selectedCategoryAccount = useMemo(() => {
    if (selectedCategoryObj?.account) return selectedCategoryObj.account;
    if (selectedCategoryObj?.accountId) {
      return flatAccounts.find(a => String(a.id) === String(selectedCategoryObj.accountId)) || null;
    }
    return flatAccounts.find(a => a.type === 'Revenue' || a.accountType?.name === 'Revenue') || null;
  }, [selectedCategoryObj, flatAccounts]);

  // Selected Bank Account object
  const selectedBankAccount = useMemo(() => {
    if (!form.bankAccountId) return null;
    return flatAccounts.find(a => String(a.id) === String(form.bankAccountId)) || null;
  }, [flatAccounts, form.bankAccountId]);

  // Calculate live Debit & Credit lines for Ledger Preview
  const ledgerLines = useMemo(() => {
    const numAmount = parseFloat(form.amount) || 0;
    const isBankPayment = form.paymentMethod === 'BANK' || form.paymentMethod === 'ONLINE' || form.paymentMethod === 'CHEQUE';
    const debitAccountName = isBankPayment && selectedBankAccount
      ? `${selectedBankAccount.glCode || '1010101'} - ${selectedBankAccount.name || selectedBankAccount.accountName}`
      : '1010103 - Cash in Hand';
    
    const creditAccountName = selectedCategoryAccount
      ? `${selectedCategoryAccount.glCode || '3010101'} - ${displayCategoryName}`
      : `3010101 - ${displayCategoryName}`;

    return [
      { type: 'Debit', account: debitAccountName, amount: numAmount, side: 'DEBIT' },
      { type: 'Credit', account: creditAccountName, amount: numAmount, side: 'CREDIT' }
    ];
  }, [form.amount, form.paymentMethod, selectedBankAccount, selectedCategoryAccount, displayCategoryName]);

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  // Upload File handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const res = await addIncomeService.uploadFile('attachment', file, (pct) => setUploadProgress(pct));
      const url = res.attachmentUrl || res.url;
      if (url) {
        handleInputChange('attachmentUrl', url);
        showToast('Attachment uploaded successfully', 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'File upload failed', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Save Income Record (Save & Redirect, or Save & New)
  const handleSave = async (saveAndNew = false) => {
    if (!isAdminOrSuperAdmin) {
      showToast('Only Admin and Super Admin can save income entries', 'warning');
      return;
    }

    if (!form.categoryId) {
      showToast('Please select an Income Category', 'warning');
      return;
    }

    let finalCustomCategoryName = '';
    let finalSubCategory = null;

    if (isCustomCategorySelected) {
      if (!form.customCategoryName || !form.customCategoryName.trim()) {
        showToast('Please enter a Custom Income Category name', 'warning');
        return;
      }
      finalCustomCategoryName = form.customCategoryName.trim();
    } else if (isOtherIncomeSelected) {
      if (!form.otherIncomeType) {
        showToast('Please select an Other Income Type', 'warning');
        return;
      }
      if (form.otherIncomeType === 'Other') {
        if (!form.customOtherIncome || !form.customOtherIncome.trim()) {
          showToast('Please enter Custom Other Income name', 'warning');
          return;
        }
        finalSubCategory = form.customOtherIncome.trim();
      } else {
        finalSubCategory = form.otherIncomeType;
      }
    }

    const numAmount = parseFloat(form.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid positive amount', 'warning');
      return;
    }

    if (form.paymentMethod === 'BANK' && !form.bankAccountId) {
      showToast('Bank Account is required when Payment Method is Bank', 'warning');
      return;
    }

    const metaParts = [
      form.payerName && `Payer: ${form.payerName}`,
      form.fatherName && `Father: ${form.fatherName}`,
      form.cnic && `CNIC: ${form.cnic}`,
      form.mobile && `Ph: ${form.mobile}`,
      form.gham && `Gham: ${form.gham}`,
      form.address && `Address: ${form.address}`,
      form.remarks
    ].filter(Boolean);

    const payload = {
      categoryId: form.categoryId,
      customCategoryName: finalCustomCategoryName,
      subCategory: finalSubCategory,
      amount: form.amount,
      date: form.date,
      paymentMethod: form.paymentMethod,
      bankAccountId: form.bankAccountId,
      referenceNumber: form.referenceNumber,
      remarks: metaParts.join(' | '),
      attachmentUrl: form.attachmentUrl
    };

    setSubmitting(true);
    try {
      if (id) {
        await updateRecord(id, payload);
        showToast('Income entry updated successfully!', 'success');
      } else {
        await createRecord(payload);
        showToast('Income entry saved successfully! Journal Voucher posted.', 'success');
      }

      setIsDirty(false);

      if (saveAndNew) {
        setForm({
          categoryId: availableCategories.length > 0 ? availableCategories[0].id : '',
          otherIncomeType: '',
          customOtherIncome: '',
          customCategoryName: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'CASH',
          bankAccountId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
          referenceNumber: '',
          remarks: '',
          attachmentUrl: ''
        });
        if (id) navigate('/add-income/new');
      } else {
        navigate('/add-income/records');
      }
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to save income record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel Handler
  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        navigate('/add-income/records');
      }
    } else {
      navigate('/add-income/records');
    }
  };

  // Category Submit
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      showToast('Category Name is required', 'warning');
      return;
    }

    setCategorySubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryForm);
        showToast('Income Category updated successfully', 'success');
      } else {
        const created = await createCategory(categoryForm);
        showToast('Income Category created successfully', 'success');
        if (created?.data?.id) {
          handleInputChange('categoryId', created.data.id);
        }
      }
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', accountId: '', isActive: true });
      setIsCategoryModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to save category', 'error');
    } finally {
      setCategorySubmitting(false);
    }
  };

  const inputStyle = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500/60 transition-all font-medium';
  const labelStyle = 'block text-xs font-semibold text-slate-400 mb-1.5';

  if (fetchingRecord) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        <span className="text-sm font-medium">Loading income record...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/add-income/records"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
            title="View All Records"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mb-0.5">
              <span>Money In</span>
              <span>/</span>
              <span className="text-slate-300">Add Income</span>
            </div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              {id ? 'Edit Income Entry' : 'Add Income Entry'}
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20">
                {id ? 'Editing Record' : 'New Registration'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record and post new income directly to the General Ledger with real-time accounting journal generation
            </p>
          </div>
        </div>

        <div className={pageActionsClass}>
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <Tag className="h-4 w-4 text-brand-400" />
            Manage Categories ({availableCategories.length})
          </button>

          <Link
            to="/add-income/records"
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <List className="h-4 w-4 text-slate-400" />
            View All Records
          </Link>
        </div>
      </div>

      {/* Main Form Body */}
      <form onSubmit={(e) => { e.preventDefault(); handleSave(false); }} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left / Top Main Section: Income Information */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="bg-slate-900/90 border-slate-800/80 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-400" />
                  Income Information
                </h3>
                <button
                  type="button"
                  onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', accountId: '', isActive: true }); setIsCategoryModalOpen(true); }}
                  className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Manage Categories
                </button>
              </div>

              {/* Row 1: Income Category & Conditional Dropdowns/Inputs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* Main Income Category Dropdown */}
                <div className={(isOtherIncomeSelected || isCustomCategorySelected) ? 'col-span-1' : 'col-span-full'}>
                  <label className={labelStyle}>
                    Income Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => {
                      handleInputChange('categoryId', e.target.value);
                      if (e.target.value !== 'CUSTOM') {
                        handleInputChange('customCategoryName', '');
                      }
                    }}
                    className={inputStyle}
                    required
                  >
                    <option value="" disabled>Select Income Category</option>
                    {availableCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                    <option value="CUSTOM">Custom</option>
                  </select>
                </div>

                {/* Conditional 1: Other Income Type Dropdown (side-by-side 50/50 with Income Category on desktop) */}
                {isOtherIncomeSelected && (
                  <div className="col-span-1 animate-in fade-in duration-200">
                    <label className={labelStyle}>
                      Other Income Type <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={form.otherIncomeType}
                      onChange={(e) => handleInputChange('otherIncomeType', e.target.value)}
                      className={inputStyle}
                      required={isOtherIncomeSelected}
                    >
                      <option value="" disabled>Select Other Income Type</option>
                      {OTHER_INCOME_TYPES.map((typeOption) => (
                        <option key={typeOption} value={typeOption}>
                          {typeOption}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Conditional 2: Custom Income Category Input (side-by-side 50/50 with Income Category on desktop) */}
                {isCustomCategorySelected && (
                  <div className="col-span-1 animate-in fade-in duration-200">
                    <label className={labelStyle}>
                      Custom Income Category <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Income Category"
                      value={form.customCategoryName}
                      onChange={(e) => handleInputChange('customCategoryName', e.target.value)}
                      className={inputStyle}
                      required={isCustomCategorySelected}
                    />
                  </div>
                )}

                {/* Nested Sub-conditional: Custom Other Income text input (when Other Income Type === 'Other') */}
                {isOtherIncomeSelected && form.otherIncomeType === 'Other' && (
                  <div className="col-span-full animate-in fade-in duration-200">
                    <label className={labelStyle}>
                      Custom Other Income <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Other Income Name"
                      value={form.customOtherIncome}
                      onChange={(e) => handleInputChange('customOtherIncome', e.target.value)}
                      className={inputStyle}
                      required={form.otherIncomeType === 'Other'}
                    />
                  </div>
                )}
              </div>

              {/* Row 2: Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>
                    Amount (PKR) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => handleInputChange('amount', e.target.value)}
                      className={`${inputStyle} font-mono font-bold text-brand-300 text-base`}
                      required
                    />
                  </div>
                  {form.amount > 0 && (
                    <p className="text-[11px] font-mono text-emerald-400 mt-1 font-semibold">
                      PKR {parseFloat(form.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelStyle}>
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Row 3: Payment Method & Bank Account */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={(form.paymentMethod === 'BANK' || form.paymentMethod === 'ONLINE' || form.paymentMethod === 'CHEQUE') ? 'col-span-1' : 'col-span-full'}>
                  <label className={labelStyle}>
                    Payment Method <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    className={inputStyle}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>

                {/* Bank Account — Visible for Bank, Online, Cheque */}
                {(form.paymentMethod === 'BANK' || form.paymentMethod === 'ONLINE' || form.paymentMethod === 'CHEQUE') && (
                  <div className="col-span-1 animate-in fade-in duration-200">
                    <label className={labelStyle}>
                      Bank Account {form.paymentMethod === 'BANK' && <span className="text-red-400">*</span>}
                    </label>
                    <select
                      value={form.bankAccountId}
                      onChange={(e) => handleInputChange('bankAccountId', e.target.value)}
                      className={inputStyle}
                      required={form.paymentMethod === 'BANK'}
                    >
                      <option value="">Select Bank Account</option>
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.glCode} - {acc.name || acc.accountName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Reference Number */}
              <div>
                <label className={labelStyle}>Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. Receipt # / Cheque # / Deposit Slip #"
                  value={form.referenceNumber}
                  onChange={(e) => handleInputChange('referenceNumber', e.target.value)}
                  className={inputStyle}
                />
              </div>

              {/* Payer Bio-Data Section */}
              <div className="pt-4 border-t border-slate-800/80 space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Payer Bio-Data (رقم جمع کروانے والے کی معلومات)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyle}>Payer / Received From Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Muhammad Ali"
                      value={form.payerName}
                      onChange={(e) => handleInputChange('payerName', e.target.value)}
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Father / Husband Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Abdul Rehman"
                      value={form.fatherName}
                      onChange={(e) => handleInputChange('fatherName', e.target.value)}
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>CNIC Number</label>
                    <CNICInput
                      value={form.cnic}
                      onChange={(e) => handleInputChange('cnic', e.target.value)}
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Mobile Phone Number</label>
                    <PhoneInput
                      value={form.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value)}
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Gham Details</label>
                    <input
                      type="text"
                      placeholder="e.g. Kukma / Nagalpur"
                      value={form.gham}
                      onChange={(e) => handleInputChange('gham', e.target.value)}
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelStyle}>Address / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Baldia Town, Karachi"
                      value={form.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className={labelStyle}>Remarks / Narration</label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed description or purpose of income..."
                  value={form.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  className={`${inputStyle} resize-none`}
                />
              </div>

              {/* Attachment Upload */}
              <div>
                <label className={labelStyle}>Attachment Upload (Optional)</label>
                <div className="border-2 border-dashed border-slate-800 hover:border-brand-500/50 rounded-xl p-4 bg-slate-950/40 text-center transition-all">
                  {form.attachmentUrl ? (
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="h-4 w-4 text-brand-400 shrink-0" />
                        <span className="text-xs text-slate-200 truncate">{form.attachmentUrl}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={form.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-400 hover:underline"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => handleInputChange('attachmentUrl', '')}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex flex-col items-center justify-center gap-1.5 mx-auto text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {uploading ? (
                          <Loader2 className="h-6 w-6 text-brand-400 animate-spin" />
                        ) : (
                          <Paperclip className="h-6 w-6 text-brand-400" />
                        )}
                        <span className="text-xs font-semibold">
                          {uploading ? `Uploading (${uploadProgress || 0}%)...` : 'Click to Upload Attachment (Receipt/Invoice)'}
                        </span>
                        <span className="text-[10px] text-slate-500">Supports Images, PDF, Word documents up to 8MB</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Right / Bottom Secondary Section: Accounting Information */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-slate-900/90 border-slate-800/80 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-400" />
                  Accounting Information
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Step 2 of 2</span>
              </div>

              {/* Mapped GL Account */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">GL Account:</span>
                  <span className="font-mono text-brand-300 font-bold">
                    {selectedCategoryAccount?.glCode || '3010101'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-200">
                  {displayCategoryName}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>Level: {selectedCategoryAccount?.accountLevel || 'GL'}</span>
                  <span>Type: REVENUE</span>
                </div>
              </div>

              {/* Live Ledger Entry Preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Ledger Preview</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-normal">Double-Entry Balanced</span>
                </h4>

                <div className="border border-slate-800/80 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-950/80 px-3 py-2 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider grid grid-cols-12">
                    <span className="col-span-3">Type</span>
                    <span className="col-span-6">Account</span>
                    <span className="col-span-3 text-right">Amount</span>
                  </div>

                  {ledgerLines.map((line, idx) => (
                    <div key={idx} className="px-3 py-2.5 border-b border-slate-800/50 last:border-0 grid grid-cols-12 items-center">
                      <span className="col-span-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          line.side === 'DEBIT'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            : 'bg-blue-950 text-blue-400 border border-blue-800/40'
                        }`}>
                          {line.type}
                        </span>
                      </span>
                      <span className="col-span-6 text-slate-200 font-medium truncate pr-1">
                        {line.account}
                      </span>
                      <span className="col-span-3 text-right font-mono font-bold text-slate-100">
                        PKR {line.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auto Journal Preview */}
              <div className="p-3.5 bg-brand-950/20 border border-brand-500/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-brand-400" /> Auto Journal Preview
                  </span>
                  <span className="text-[10px] font-mono bg-brand-950 text-brand-300 border border-brand-800 px-1.5 py-0.5 rounded">
                    Voucher: BR-AUTO
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Saving this income entry creates a posted <strong className="text-slate-200">Bank/Cash Receipt (BR)</strong> journal entry. General Ledger, Trial Balance, Income Statement, and Dashboard totals will update automatically using <strong className="text-slate-200">{displayCategoryName}</strong>.
                </p>
              </div>

              {/* Actions Section */}
              <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={submitting || !isAdminOrSuperAdmin}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    isAdminOrSuperAdmin
                      ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-950/40'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitting ? 'Saving Income Record...' : id ? 'Update Income' : 'Save Income'}
                </button>

                {!id && (
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={submitting || !isAdminOrSuperAdmin}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-brand-400" />
                    Save &amp; New
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full py-2 bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </Card>
          </div>
        </div>
      </form>

      {/* Modal: Manage Income Categories */}
      {isCategoryModalOpen && (
        <Modal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title="Manage Income Categories"
        >
          <div className="space-y-6 pt-2">
            {/* Category Form */}
            {isAdminOrSuperAdmin && (
              <form onSubmit={handleCategorySubmit} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                  {editingCategory ? 'Edit Category' : 'Create New Income Category'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category Name *</label>
                    <input
                      type="text"
                      placeholder="Category Name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mapped Revenue Account (CoA)</label>
                    <select
                      value={categoryForm.accountId}
                      onChange={(e) => setCategoryForm({ ...categoryForm, accountId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="">Auto-map Revenue Account</option>
                      {flatAccounts.filter(a => a.type === 'Revenue' || a.accountType?.name === 'Revenue').map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.glCode} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Short description..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoryForm.isActive}
                      onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-brand-500 focus:ring-brand-500"
                    />
                    Active Category
                  </label>

                  <div className="flex items-center gap-2">
                    {editingCategory && (
                      <button
                        type="button"
                        onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '', accountId: '', isActive: true }); }}
                        className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={categorySubmitting}
                      className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      {categorySubmitting ? 'Saving...' : editingCategory ? 'Update' : 'Add Category'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Categories List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Configured Income Categories ({availableCategories.length})
              </h4>
              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800">
                {availableCategories.map((cat) => (
                  <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                    <div>
                      <span className="font-bold text-xs text-slate-200">{cat.name}</span>
                      {cat.description && <p className="text-[10px] text-slate-500 mt-0.5">{cat.description}</p>}
                    </div>
                    {isAdminOrSuperAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat);
                            setCategoryForm({
                              name: cat.name || '',
                              description: cat.description || '',
                              accountId: cat.accountId || '',
                              isActive: cat.isActive !== undefined ? cat.isActive : true
                            });
                          }}
                          className="p-1 rounded bg-slate-800 text-slate-300 hover:text-brand-400 cursor-pointer"
                          title="Edit"
                        >
                          <Tag className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCategory(cat.id)}
                          className="p-1 rounded bg-red-950/40 text-red-400 cursor-pointer"
                          title="Delete"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
