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
import { ChevronRight, Lock, Sparkles, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

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
    .max(80, "Account name is too long")
    .regex(/^[a-zA-Z0-9\s.()&-]+$/, "Account name should only contain letters, numbers, spaces, dots, hyphens, and parentheses"),
  type: zod.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
  detailType: zod.string().min(1, "Detail type is required"),
  parentCode: zod.string().min(7, "Parent category is required"),
  level: zod.any().optional(),
  isLocked: zod.boolean().optional(),
  isReserved: zod.boolean().optional(),
  currency: zod.string().min(3, "Select a valid 3-letter currency code").regex(/^[A-Z]{3}$/, "Currency must be exactly 3 uppercase letters (e.g. PKR)"),
  description: zod.string().max(200, "Description must be under 200 characters").regex(/^$|^[a-zA-Z0-9\s.,#\/-]+$/, "Description contains invalid characters").optional(),
  initialBalance: zod.preprocess((val) => Number(val), zod.number().default(0)),
});

const detailTypeOptions = {
  Asset: ['Cash', 'Receivable', 'Inventory', 'Prepayments', 'Fixed Asset', 'Accumulated Depreciation', 'Header'],
  Liability: ['Payable', 'Credit Card', 'Accrued Expense', 'Long Term Loan', 'Header'],
  Equity: ['Equity', 'Retained Earnings', 'Capital', 'Header'],
  Revenue: ['Revenue', 'Other Revenue', 'Header'],
  Expense: ['Expense', 'COGS', 'Tax Expense', 'Other Expense', 'Header'],
};

export const AccountFormDrawer = ({ isOpen, onClose, editingAccount }) => {
  const { treeAccounts, flatAccounts, addAccount, updateAccount } = useCoaStore();
  const { logActivity } = useJournalStore();
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
      level: 'GL',
      isLocked: false,
      isReserved: false,
      currency: 'PKR',
      description: '',
      initialBalance: 0,
    },
  });

  const selectedType = watch('type');
  const parentCodeVal = watch('parentCode');
  const watchedCode = watch('code');

  // Filter possible parents: must be Level 3 SUBSIDIARY accounts across all types
  const potentialParents = useMemo(() => {
    return allAccounts.filter(acc => acc.level === 'SUBSIDIARY');
  }, [allAccounts]);

  // When parent changes (in Create mode), auto-update type and detailType
  useEffect(() => {
    if (!editingAccount && parentCodeVal) {
      const parentAcc = allAccounts.find(a => a.code === parentCodeVal);
      if (parentAcc) {
        // Always auto-set Type based on parent
        setValue('type', parentAcc.type);
        
        // Auto-set Nature (detailType) based on the first valid option for that Type
        const options = detailTypeOptions[parentAcc.type] || [];
        if (options.length > 0) {
          setValue('detailType', options[0]);
        }
      }
    }
  }, [parentCodeVal, editingAccount, allAccounts, setValue]);

  // Auto-suggest / generate a GL code based on selected parent and siblings
  const generatedCode = useMemo(() => {
    if (!parentCodeVal) return '';
    const siblings = allAccounts.filter(a => a.parentCode === parentCodeVal);
    const sibNumeric = siblings.map(a => parseInt(a.code, 10)).filter(Number.isFinite);
    const sibMax = sibNumeric.length ? Math.max(...sibNumeric) : parseInt(parentCodeVal, 10);
    return String(sibMax + 1).padStart(7, '0');
  }, [parentCodeVal, allAccounts]);

  // Apply auto-suggested code when it changes (only in Create mode)
  useEffect(() => {
    if (!editingAccount && generatedCode) {
      setValue('code', generatedCode);
      setCodeInputVal(generatedCode);
      clearErrors('code');
    }
  }, [generatedCode, editingAccount, setValue, clearErrors]);

  // Load account data for editing or reset for creation
  useEffect(() => {
    if (isOpen) {
      setCodeInputVal('');
      if (editingAccount) {
        reset({
          code: editingAccount.code,
          name: editingAccount.name,
          type: editingAccount.type,
          detailType: editingAccount.detailType,
          parentCode: editingAccount.parentCode || '',
          level: editingAccount.level || 'GL',
          isLocked: editingAccount.status === 'Inactive',
          currency: editingAccount.currency || 'PKR',
          description: editingAccount.description || '',
          initialBalance: editingAccount.initialBalance || 0,
        });
        setCodeInputVal(editingAccount.code);
      } else {
        const defaultParent = potentialParents.length > 0 ? potentialParents[0] : null;
        reset({
          code: '',
          name: '',
          type: defaultParent ? defaultParent.type : 'Asset',
          detailType: defaultParent ? (detailTypeOptions[defaultParent.type]?.[0] || 'Cash') : 'Cash',
          parentCode: defaultParent ? defaultParent.code : '',
          currency: 'PKR',
          description: '',
          initialBalance: 0,
          level: 'GL'
        });
      }
    }
  }, [editingAccount, reset, isOpen, potentialParents]);

  // Real-time code validation
  const codeValidation = useMemo(() => {
    const val = codeInputVal || watchedCode || '';
    if (!val) return { status: 'empty', message: '' };
    if (!/^\d{7}$/.test(val)) return { status: 'invalid', message: 'Code must be exactly 7 digits' };
    const isDuplicate = allAccounts.some(
      a => a.code === val && (!editingAccount || a.id !== editingAccount.id)
    );
    if (isDuplicate) return { status: 'duplicate', message: 'This code already exists.' };
    return { status: 'valid', message: 'Code is valid and unique ✅' };
  }, [codeInputVal, watchedCode, allAccounts, editingAccount]);

  // Nature mismatch warning
  const natureMismatchWarning = useMemo(() => {
    const code = codeInputVal || watchedCode || '';
    if (!code || !selectedType) return null;
    const expectedPrefix = typePrefixMap[selectedType];
    if (expectedPrefix && code[0] && code[0] !== expectedPrefix) {
      return `⚠️ Code "${code}" starts with "${code[0]}" but ${selectedType} accounts should start with "${expectedPrefix}".`;
    }
    return null;
  }, [codeInputVal, watchedCode, selectedType]);

  // Expense series warning
  const expenseSeriesWarning = useMemo(() => {
    const code = codeInputVal || watchedCode || '';
    if (selectedType === 'Expense' && code && !code.startsWith('4')) {
      return 'Accounts under Expenses must start with 4.';
    }
    return null;
  }, [codeInputVal, watchedCode, selectedType]);

  // Breadcrumb for edit mode
  const breadcrumb = useMemo(() => {
    if (!editingAccount) return [];
    return buildBreadcrumb(editingAccount, allAccounts);
  }, [editingAccount, allAccounts]);

  const onSubmitForm = async (data) => {
    // Duplicate code check
    const codeExists = allAccounts.some(
      (acc) => acc.code === data.code && (!editingAccount || acc.id !== editingAccount.id)
    );
    if (codeExists) {
      setError('code', { type: 'manual', message: 'This code already exists.' });
      showToast('Account code is already in use', 'error');
      return;
    }

    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, data);
        logActivity('Modify Account', `Modified Account ${editingAccount.code} - ${editingAccount.name}.`);
        showToast('✅ Account updated successfully', 'success');
      } else {
        const created = await addAccount({ ...data, level: 'GL' });
        logActivity('Create Account', `Created Account ${created.glCode || data.code} - ${created.accountName || data.name}.`);
        showToast('✅ Account created successfully', 'success');
      }
      onClose();
    } catch (e) {
      showToast(e.message || 'An error occurred', 'error');
    }
  };

  const isSaveDisabled = isSubmitting || codeValidation.status !== 'valid' || (editingAccount && editingAccount.isReserved);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAccount ? `Edit Account: ${editingAccount.code}` : "Add GL Account"}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
        
        {/* Breadcrumb (Edit Mode) */}
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

        {/* Fix 7 — Reserved badge */}
        {editingAccount?.isReserved && (
          <div className="flex items-center justify-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Lock className="h-3.5 w-3.5 mr-2" /> This is a system-reserved account and cannot be modified.
          </div>
        )}

        {/* Parent Selection */}
        <Select
          label="Parent L3 Category"
          required
          disabled={!!editingAccount} // Cannot change parent after creation
          error={errors.parentCode?.message}
          {...register('parentCode')}
        >
          <option value="" disabled>Select a Level 3 Parent...</option>
          {potentialParents.map(parent => (
            <option key={parent.code} value={parent.code}>
              {parent.code} - {parent.name} ({parent.type})
            </option>
          ))}
        </Select>

        {/* Auto-suggested Code & Name Row */}
        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
          <div className="relative">
            <Input
              label="Account Code"
              required
              disabled={!!editingAccount?.isReserved}
              maxLength={7}
              {...register('code', {
                onChange: (e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 7);
                  setCodeInputVal(val);
                  setValue('code', val);
                  if (val.length === 7) clearErrors('code');
                }
              })}
              className={`font-mono text-center tracking-widest bg-slate-900/60
                ${codeValidation.status === 'valid' ? 'border-emerald-500/50 text-emerald-400' : ''}
                ${codeValidation.status === 'duplicate' ? 'border-red-500/50 text-red-400' : ''}
                ${codeValidation.status === 'invalid' ? 'border-amber-500/50 text-amber-400' : ''}
              `}
            />
            {!editingAccount && (
              <Sparkles className="absolute right-2 top-[34px] h-4 w-4 text-brand-500/40 pointer-events-none" title="Auto-suggested" />
            )}
            {/* Real-time Code Validation Feedback */}
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className={codeValidation.status === 'valid' ? 'text-emerald-400' : 'text-red-400'}>
                {codeValidation.message}
              </span>
              <span className="text-slate-500">{codeInputVal.length}/7</span>
            </div>
          </div>
          
          <Input
            label="Account Name"
            required
            error={errors.name?.message}
            placeholder="e.g. Current Account - PKR"
            disabled={!!editingAccount?.isLocked || !!editingAccount?.isReserved}
            {...register('name')}
          />
        </div>

        {/* Warnings for Code series */}
        {expenseSeriesWarning && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {expenseSeriesWarning}
          </div>
        )}
        {natureMismatchWarning && !expenseSeriesWarning && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {natureMismatchWarning}
          </div>
        )}

        {/* Nature & Currency Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Nature (Detail Subtype)"
            required
            error={errors.detailType?.message}
            disabled={!!editingAccount?.isLocked || !!editingAccount?.isReserved}
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
            disabled={!!editingAccount?.isLocked || !!editingAccount?.isReserved}
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

        {/* Edit mode: Locked / Reserved flags */}
        {editingAccount && (
          <div className="flex items-center gap-6 py-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" disabled={!!editingAccount.isLocked || !!editingAccount.isReserved} {...register('isLocked')} />
              <span className="text-sm text-slate-400">Is Locked (Inactive)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" disabled={!!editingAccount.isLocked || !!editingAccount.isReserved} {...register('isReserved')} />
              <span className="text-sm text-slate-400">Is Reserved</span>
            </label>
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Description
          </label>
          <textarea
            rows="2"
            disabled={!!editingAccount?.isLocked || !!editingAccount?.isReserved}
            placeholder="Add detailed explanation of this account's purpose..."
            className={`
              w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-md text-sm text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all duration-200
              ${errors.description ? 'border-red-500/50' : ''}
              ${(editingAccount?.isLocked || editingAccount?.isReserved) ? 'cursor-not-allowed opacity-70' : ''}
            `}
            {...register('description')}
          />
          {errors.description && (
            <span className="text-xs text-red-400">⚠️ {errors.description.message}</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSaveDisabled}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
            title={codeValidation.status !== 'valid' ? 'Fix validation errors before saving' : ''}
          >
            {editingAccount ? 'Save Changes' : 'Save Account'}
          </Button>
        </div>

      </form>
    </Modal>
  );
};
