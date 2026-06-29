import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useCoaStore } from '../../store/coaStore';
import { useJournalStore } from '../../store/journalStore';
import { showToast } from '../ui/Toast';
import { ArrowLeft, ArrowRight, Check, Coins, CreditCard, Receipt, TrendingUp, Sparkles, Lock, CheckCircle2, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';

// Maps account type to expected first digit of GL code
const typePrefixMap = { Asset: '1', Liability: '2', Revenue: '3', Expense: '4' };

// Build breadcrumb from parent chain
function buildBreadcrumb(account, allAccounts) {
  const crumbs = [];
  let current = account;
  while (current) {
    crumbs.unshift(current.name);
    current = allAccounts.find(a => a.code === current.parentCode);
  }
  return crumbs;
}

// Zod validation schema
const accountSchema = zod.object({
  code: zod.string()
    .length(7, "GL Code must be exactly 7 digits")
    .regex(/^\d{7}$/, "GL Code must contain 7 numbers only"),
  name: zod.string()
    .min(3, "Account name must be at least 3 characters")
    .max(80, "Account name is too long"),
  type: zod.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
  detailType: zod.string().min(1, "Detail type is required"),
  parentCode: zod.string().nullable().optional(),
  level: zod.any().optional(),
  isLocked: zod.boolean().optional(),
  isReserved: zod.boolean().optional(),
  currency: zod.string().min(3, "Select a valid 3-letter currency code"),
  description: zod.string().max(200, "Description must be under 200 characters").optional(),
  initialBalance: zod.preprocess((val) => Number(val), zod.number().default(0)),
});

const detailTypeOptions = {
  Asset: ['Cash', 'Receivable', 'Inventory', 'Prepayments', 'Fixed Asset', 'Accumulated Depreciation', 'Header'],
  Liability: ['Payable', 'Credit Card', 'Accrued Expense', 'Long Term Loan', 'Header'],
  Equity: ['Equity', 'Retained Earnings', 'Capital', 'Header'],
  Revenue: ['Revenue', 'Other Revenue', 'Header'],
  Expense: ['COGS', 'Expense', 'Tax Expense', 'Other Expense', 'Header'],
};

export const AccountFormDrawer = ({ isOpen, onClose, editingAccount }) => {
  const { treeAccounts, flatAccounts, addAccount, updateAccount } = useCoaStore();
  const { logActivity } = useJournalStore();
  const [step, setStep] = useState(1);
  const [codeInputVal, setCodeInputVal] = useState('');

  // Flatten nested tree for searching/filtering
  const allAccounts = useMemo(() => {
    const flatten = (nodes) => nodes.reduce((acc, node) => {
      acc.push(node);
      if (node.children) acc.push(...flatten(node.children));
      return acc;
    }, []);
    return treeAccounts.length > 0 ? flatten(treeAccounts) : flatAccounts;
  }, [treeAccounts, flatAccounts]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: '',
      name: '',
      type: 'Asset',
      detailType: 'Cash',
      parentCode: '',
      level: 'PARENT',
      isLocked: false,
      isReserved: false,
      currency: 'PKR',
      description: '',
      initialBalance: 0,
    },
  });

  const selectedType = watch('type');
  const parentCodeVal = watch('parentCode');
  const accountNameVal = watch('name');
  const watchedCode = watch('code');

  // Real-time code validation (Fix 1, 3, 10)
  const codeValidation = useMemo(() => {
    const val = codeInputVal || watchedCode || '';
    if (!val) return { status: 'empty', message: '' };
    if (!/^\d{7}$/.test(val)) return { status: 'invalid', message: 'Code must be exactly 7 digits' };
    const isDuplicate = allAccounts.some(
      a => a.code === val && (!editingAccount || a.id !== editingAccount.id)
    );
    if (isDuplicate) return { status: 'duplicate', message: 'This code already exists. Use a unique code.' };
    return { status: 'valid', message: 'Code is valid and unique ✅' };
  }, [codeInputVal, watchedCode, allAccounts, editingAccount]);

  // Nature mismatch warning (Fix 9)
  const natureMismatchWarning = useMemo(() => {
    const code = codeInputVal || watchedCode || '';
    if (!code || !selectedType) return null;
    const expectedPrefix = typePrefixMap[selectedType];
    if (expectedPrefix && code[0] && code[0] !== expectedPrefix) {
      return `⚠️ Code "${code}" starts with "${code[0]}" but ${selectedType} accounts should start with "${expectedPrefix}". Please verify.`;
    }
    return null;
  }, [codeInputVal, watchedCode, selectedType]);

  // Expense series warning (Fix 2)
  const expenseSeriesWarning = useMemo(() => {
    const code = codeInputVal || watchedCode || '';
    if (selectedType === 'Expense' && code && !code.startsWith('4')) {
      return 'Accounts under Expenses must start with 4.';
    }
    return null;
  }, [codeInputVal, watchedCode, selectedType]);

  // Breadcrumb for edit mode (Fix 20)
  const breadcrumb = useMemo(() => {
    if (!editingAccount) return [];
    return buildBreadcrumb(editingAccount, allAccounts);
  }, [editingAccount, allAccounts]);

  // Filter possible parents: must be Level 2 PARENT level accounts of same type
  const potentialParents = useMemo(() => {
    return allAccounts.filter((acc) => {
      return acc.type === selectedType && acc.level === 'PARENT';
    });
  }, [allAccounts, selectedType]);

  // Auto-suggest / generate a GL code based on selected parent and siblings
  const generatedCode = useMemo(() => {
    if (!parentCodeVal) return '';
    const siblings = allAccounts.filter(a => a.parentCode === parentCodeVal);
    const sibNumeric = siblings.map(a => parseInt(a.code, 10)).filter(Number.isFinite);
    const sibMax = sibNumeric.length ? Math.max(...sibNumeric) : parseInt(parentCodeVal, 10);
    return String(sibMax + 1).padStart(7, '0');
  }, [parentCodeVal, allAccounts]);

  // Update form fields when category changes
  useEffect(() => {
    if (!editingAccount && isOpen) {
      const options = detailTypeOptions[selectedType] || [];
      if (options.length > 0) {
        setValue('detailType', options[0]);
      }
      
      // Auto-select first parent under new type
      const firstParent = allAccounts.find(acc => acc.type === selectedType && acc.level === 'PARENT');
      if (firstParent) {
        setValue('parentCode', firstParent.code);
      } else {
        setValue('parentCode', '');
      }
    }
  }, [selectedType, setValue, editingAccount, allAccounts, isOpen]);

  // Load account data for editing or reset for creation
  useEffect(() => {
    if (isOpen) {
      setCodeInputVal('');
      if (editingAccount) {
        setStep(1);
        reset({
          code: editingAccount.code,
          name: editingAccount.name,
          type: editingAccount.type,
          detailType: editingAccount.detailType,
          parentCode: editingAccount.parentCode || '',
          level: editingAccount.level || 'PARENT',
          isLocked: editingAccount.status === 'Inactive',
          currency: editingAccount.currency || 'PKR',
          description: editingAccount.description || '',
          initialBalance: editingAccount.initialBalance || 0,
        });
        setCodeInputVal(editingAccount.code);
      } else {
        setStep(1);
        const defaultParent = allAccounts.find(acc => acc.type === 'Asset' && acc.level === 'PARENT');
        reset({
          code: '',
          name: '',
          type: 'Asset',
          detailType: 'Cash',
          parentCode: defaultParent ? defaultParent.code : '',
          currency: 'PKR',
          description: '',
          initialBalance: 0,
        });
      }
    }
  }, [editingAccount, reset, isOpen, allAccounts]);

  // Apply code selection when stepping into summary (Fix 8)
  useEffect(() => {
    if (step === 4 && generatedCode) {
      setValue('code', generatedCode);
      setCodeInputVal(generatedCode);
    }
  }, [step, generatedCode, setValue]);

  const onSubmitForm = async (data) => {
    // Fix 6 — Require parent for new accounts
    if (!editingAccount && !data.parentCode) {
      setError('parentCode', { type: 'manual', message: 'Please select a valid parent account' });
      showToast('Please select a valid parent account', 'warning');
      return;
    }

    // Fix 3 — Duplicate code check
    const codeExists = allAccounts.some(
      (acc) => acc.code === data.code && (!editingAccount || acc.id !== editingAccount.id)
    );
    if (codeExists) {
      setError('code', { type: 'manual', message: 'This code already exists. Please use a unique code.' });
      showToast('Account code is already in use', 'error');
      return;
    }

    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, data);
        logActivity('Modify Account', `Modified Account ${editingAccount.code} - ${editingAccount.name}.`);
        showToast('✅ Account updated successfully', 'success');
      } else {
        const created = await addAccount({ ...data, level: 'SUBSIDIARY' });
        logActivity('Create Account', `Created Account ${created.glCode || data.code} - ${created.accountName || data.name}.`);
        showToast('✅ Account created successfully', 'success');
      }
      onClose();
    } catch (e) {
      showToast(e.message || 'An error occurred', 'error');
    }
  };

  const handleSelectType = (value) => {
    setValue('type', value);
    // Automatically select the first parent matching the selected type
    const firstParent = allAccounts.find(acc => acc.type === value && acc.level === 'PARENT');
    if (firstParent) {
      setValue('parentCode', firstParent.code);
    } else {
      setValue('parentCode', '');
    }
    setStep(2);
  };

  const handleSelectParent = (code) => {
    setValue('parentCode', code);
    setStep(3);
  };

  const mainCategories = [
    { name: 'Assets', value: 'Asset', icon: Coins, desc: 'Economic resources owned or controlled.', style: 'hover:border-brand-500/50 hover:bg-brand-500/5 border-slate-800 bg-slate-900/40 text-brand-400' },
    { name: 'Liabilities', value: 'Liability', icon: CreditCard, desc: 'Present financial obligations of the business.', style: 'hover:border-red-500/50 hover:bg-red-500/5 border-slate-800 bg-slate-900/40 text-red-400' },
    { name: 'Revenue', value: 'Revenue', icon: TrendingUp, desc: 'Inflow of economic benefits from operations.', style: 'hover:border-emerald-500/50 hover:bg-emerald-500/5 border-slate-800 bg-slate-900/40 text-emerald-400' },
    { name: 'Expenses', value: 'Expense', icon: Receipt, desc: 'Outflows or depletion of assets for operations.', style: 'hover:border-amber-500/50 hover:bg-amber-500/5 border-slate-800 bg-slate-900/40 text-amber-400' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAccount ? `Edit Account: ${editingAccount.code}` : `Create Account Wizard (Step ${step} of 4)`}
      size="md"
    >
      {editingAccount ? (
        /* ==================== EDIT MODE (SIMPLE FORM) ==================== */
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-5">

          {/* Breadcrumb (Fix 20) */}
          {breadcrumb.length > 1 && (
            <div className="flex items-center flex-wrap gap-1 text-[11px] text-slate-500 bg-slate-950/60 border border-slate-800/50 rounded-lg px-3 py-2">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={i === breadcrumb.length - 1 ? 'text-slate-300 font-semibold' : 'text-slate-500'}>{crumb}</span>
                  {i < breadcrumb.length - 1 && <ChevronRight className="h-3 w-3 text-slate-600" />}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="Account Code (Permanent)"
                disabled
                {...register('code')}
              />
              {/* Fix 7 — Reserved badge */}
              {editingAccount.isReserved && (
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">
                  <Lock className="h-2.5 w-2.5" /> RESERVED
                </span>
              )}
            </div>
            <Input
              label="Account Name"
              required
              error={errors.name?.message}
              placeholder="e.g. Current Account - PKR"
              disabled={!!editingAccount.isLocked || !!editingAccount.isReserved}
              {...register('name')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Account Type"
              disabled
              {...register('type')}
            >
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Equity">Equity</option>
              <option value="Revenue">Revenue</option>
              <option value="Expense">Expense</option>
            </Select>

            <Select
              label="Detail Type (Subtype)"
              disabled
              {...register('detailType')}
            >
              {(detailTypeOptions[selectedType] || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Currency"
              required
              error={errors.currency?.message}
              disabled={!!editingAccount.isLocked || !!editingAccount.isReserved}
              {...register('currency')}
            >
              <option value="PKR">PKR - Pakistani Rupee</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="JPY">JPY - Japanese Yen</option>
              <option value="AUD">AUD - Australian Dollar</option>
            </Select>

            <div className="flex items-center gap-4 mt-8">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" disabled={!!editingAccount.isLocked || !!editingAccount.isReserved} {...register('isLocked')} />
                <span className="text-sm text-slate-400">Is Locked</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" disabled={!!editingAccount.isLocked || !!editingAccount.isReserved} {...register('isReserved')} />
                <span className="text-sm text-slate-400">Is Reserved</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows="3"
              disabled={!!editingAccount.isLocked || !!editingAccount.isReserved}
              placeholder="Add detailed explanation of this account's purpose..."
              className={`
                w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-md text-sm text-slate-100 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all duration-200
                ${errors.description ? 'border-red-500/50' : ''}
                ${(editingAccount.isLocked || editingAccount.isReserved) ? 'cursor-not-allowed opacity-70' : ''}
              `}
              {...register('description')}
            />
            {errors.description && (
              <span className="text-xs text-red-400">⚠️ {errors.description.message}</span>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            {/* Fix 7 — Block save for reserved */}
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !!editingAccount.isReserved}
              title={editingAccount.isReserved ? 'Reserved accounts cannot be modified' : ''}
            >
              Save Changes
            </Button>
          </div>
        </form>
      ) : (
        /* ==================== CREATE FLOW (WIZARD) ==================== */
        <div className="space-y-6">
          {/* Progress dots bar */}
          <div className="flex items-center justify-between px-6 pb-2 border-b border-slate-800/50">
            {[1, 2, 3, 4].map((stepNum) => (
              <div key={stepNum} className="flex items-center flex-1 last:flex-none">
                <div 
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-250
                    ${step === stepNum 
                      ? 'bg-brand-500 text-slate-950 scale-110 shadow-[0_0_12px_rgba(var(--color-brand-500),0.3)]' 
                      : step > stepNum 
                        ? 'bg-slate-800 text-brand-400' 
                        : 'bg-slate-900 border border-slate-800 text-slate-500'
                    }
                  `}
                >
                  {step > stepNum ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                {stepNum < 4 && (
                  <div 
                    className={`
                      h-0.5 flex-1 mx-2 transition-all duration-300
                      ${step > stepNum ? 'bg-brand-500/50' : 'bg-slate-900'}
                    `}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Wizard step panels */}
          <div>
            {step === 1 && (
              /* --- Step 1: Main Category --- */
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="text-base font-bold text-slate-100">Select Main Category</h4>
                  <p className="text-xs text-slate-500 mt-1">Choose the root section of your general ledger chart.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  {mainCategories.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedType === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => handleSelectType(cat.value)}
                        className={`
                          flex flex-col items-start p-4 text-left rounded-xl border transition-all duration-200 cursor-pointer group
                          ${isSelected 
                            ? 'border-brand-500 bg-brand-950/20 shadow-[0_0_15px_rgba(99,102,241,0.05)]' 
                            : cat.style
                          }
                        `}
                      >
                        <div className={`p-2 rounded-lg mb-3 ${isSelected ? 'bg-brand-500 text-slate-950' : 'bg-slate-900 text-slate-400 group-hover:text-slate-200'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold text-slate-200 group-hover:text-slate-100">{cat.name}</span>
                        <span className="text-xs text-slate-500 mt-1 leading-normal">{cat.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              /* --- Step 2: Parent Category --- */
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="text-base font-bold text-slate-100">Select Parent Category</h4>
                  <p className="text-xs text-slate-500 mt-1">Choose the Level 2 node where this subsidiary ledger account belongs.</p>
                </div>

                {/* Fix 6 — Warn if no parents found */}
                {potentialParents.length === 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    No Level 2 parent categories defined for {selectedType} yet. Please create a parent account first.
                  </div>
                )}
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {potentialParents.length > 0 && (
                    potentialParents.map((parent) => {
                      const isSelected = parentCodeVal === parent.code;
                      return (
                        <button
                          key={parent.code}
                          type="button"
                          onClick={() => handleSelectParent(parent.code)}
                          className={`
                            w-full flex items-center justify-between p-3.5 rounded-lg border text-left transition-all duration-150 cursor-pointer
                            ${isSelected 
                              ? 'border-brand-500/80 bg-brand-950/15 text-slate-200' 
                              : 'border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/65 text-slate-400 hover:text-slate-300'
                            }
                          `}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold font-mono tracking-wide text-brand-400">{parent.code}</span>
                            <span className="text-sm font-medium mt-0.5">{parent.name}</span>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-slate-950">
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="ghost" onClick={() => setStep(1)} className="gap-1.5 cursor-pointer">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              /* --- Step 3: Account Name & Details --- */
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="text-base font-bold text-slate-100">Account Details</h4>
                  <p className="text-xs text-slate-500 mt-1">Specify your new ledger account name and metadata fields.</p>
                </div>

                <div className="space-y-4 pt-1">
                  <Input
                    label="Account Name"
                    required
                    placeholder="e.g. Bagh-e-Hajiani Garden"
                    error={errors.name?.message}
                    {...register('name')}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Detail Subtype"
                      required
                      error={errors.detailType?.message}
                      {...register('detailType')}
                    >
                      {(detailTypeOptions[selectedType] || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Currency"
                      required
                      error={errors.currency?.message}
                      {...register('currency')}
                    >
                      <option value="PKR">PKR - Pakistani Rupee</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="JPY">JPY - Japanese Yen</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Description
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Add brief explanation of this account's purpose..."
                      className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all duration-200"
                      {...register('description')}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800/40">
                  <Button variant="ghost" onClick={() => setStep(2)} className="gap-1.5 cursor-pointer">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={() => {
                      if (!accountNameVal || accountNameVal.length < 3) {
                        showToast('Account name must be at least 3 characters', 'warning');
                        return;
                      }
                      setStep(4);
                    }} 
                    className="gap-1.5 cursor-pointer"
                  >
                    <span>Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              /* --- Step 4: Auto-Generate & Review --- */
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="text-base font-bold text-slate-100">Review & Confirm</h4>
                  <p className="text-xs text-slate-500 mt-1">Please verify the generated account details before committing to ledger.</p>
                </div>

                {/* Generated Code callout with real-time editable input (Fix 1, 10) */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center space-y-2 relative overflow-hidden group">
                  <div className="absolute top-2 right-2 text-brand-500/10 group-hover:text-brand-500/20 transition-colors">
                    <Sparkles className="h-10 w-10" />
                  </div>
                  <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                    <Lock className="h-3 w-3" />
                    <span>Auto-Generated GL Code — Override if needed</span>
                  </span>
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-56">
                      <input
                        type="text"
                        maxLength={7}
                        value={codeInputVal}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 7);
                          setCodeInputVal(val);
                          setValue('code', val);
                          if (val.length === 7) clearErrors('code');
                        }}
                        className={`w-full text-center text-2xl font-mono font-bold tracking-widest py-1.5 rounded-lg border bg-slate-900/60
                          ${codeValidation.status === 'valid' ? 'border-emerald-500/50 text-emerald-400' : ''}
                          ${codeValidation.status === 'duplicate' ? 'border-red-500/50 text-red-400' : ''}
                          ${codeValidation.status === 'invalid' ? 'border-amber-500/50 text-amber-400' : ''}
                          ${codeValidation.status === 'empty' ? 'border-slate-800 text-slate-100' : ''}
                          focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all`}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {codeValidation.status === 'valid' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                        {(codeValidation.status === 'duplicate' || codeValidation.status === 'invalid') && <XCircle className="h-4 w-4 text-red-400" />}
                      </div>
                    </div>
                    {codeValidation.message && (
                      <span className={`text-xs font-medium ${codeValidation.status === 'valid' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {codeValidation.message}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fix 2 — Expense series warning */}
                {expenseSeriesWarning && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {expenseSeriesWarning}
                  </div>
                )}

                {/* Fix 9 — Nature/series mismatch warning */}
                {natureMismatchWarning && !expenseSeriesWarning && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {natureMismatchWarning}
                  </div>
                )}

                {/* Summary panel */}
                <div className="bg-slate-900/20 border border-slate-800/60 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                    <span className="text-slate-500">Account Name</span>
                    <span className="text-slate-200 font-bold text-right truncate">{accountNameVal}</span>

                    <span className="text-slate-500">Category Type</span>
                    <span className="text-slate-200 font-semibold text-right">{selectedType}</span>

                    <span className="text-slate-500">Parent Category</span>
                    <span className="text-slate-200 font-medium text-right truncate">
                      {allAccounts.find(a => a.code === parentCodeVal)?.name || parentCodeVal}
                    </span>

                    <span className="text-slate-500">Detail Subtype</span>
                    <span className="text-slate-300 text-right">{watch('detailType')}</span>

                    <span className="text-slate-500">Currency</span>
                    <span className="text-slate-300 font-semibold text-right">{watch('currency')}</span>

                    <span className="text-slate-500">Account Level</span>
                    <span className="text-brand-400 font-bold text-right">SUBSIDIARY</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="ghost" onClick={() => setStep(3)} className="gap-1.5 cursor-pointer" disabled={isSubmitting}>
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </Button>
                  <Button 
                    variant="primary" 
                    onClick={handleSubmit(onSubmitForm)} 
                    disabled={isSubmitting || codeValidation.status !== 'valid'}
                    className="gap-1.5 cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold disabled:opacity-50"
                    title={codeValidation.status !== 'valid' ? 'Fix code errors before saving' : ''}
                  >
                    <span>Confirm &amp; Create</span>
                    <Check className="h-4 w-4 stroke-[3]" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
