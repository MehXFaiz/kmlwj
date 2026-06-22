import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useCoaStore } from '../../store/coaStore';
import { useJournalStore } from '../../store/journalStore';

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

  // Create a flat list of accounts for searching/filtering
  const allAccounts = useMemo(() => {
    const flatten = (nodes) => nodes.reduce((acc, node) => {
      acc.push(node);
      if (node.children) acc.push(...flatten(node.children));
      return acc;
    }, []);
    // if treeAccounts is populated use it, else fallback to flatAccounts
    return treeAccounts.length > 0 ? flatten(treeAccounts) : flatAccounts;
  }, [treeAccounts, flatAccounts]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    setError,
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

  // Fill detailType and parentCode defaults when type changes
  useEffect(() => {
    if (!editingAccount) {
      const options = detailTypeOptions[selectedType] || [];
      if (options.length > 0) {
        setValue('detailType', options[0]);
      }
      
      const defaultParent = allAccounts.find(acc => acc.type === selectedType && acc.level !== 'SUBSIDIARY');
      if (defaultParent) {
        setValue('parentCode', defaultParent.code);
      } else {
        setValue('parentCode', '');
      }
    }
  }, [selectedType, setValue, editingAccount, allAccounts]);

  // Load account data for editing
  useEffect(() => {
    if (editingAccount) {
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
    } else {
      const defaultParent = allAccounts.find(acc => acc.type === 'Asset' && acc.level !== 'SUBSIDIARY');
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
  }, [editingAccount, reset, isOpen, allAccounts]);

  // Filter possible parents: must be the same account type and not self, and cannot be a SUBSIDIARY
  const potentialParents = allAccounts.filter((acc) => {
    if (editingAccount && acc.id === editingAccount.id) return false; // cannot be own parent
    return acc.type === selectedType && acc.level !== 'SUBSIDIARY';
  });

  const parentCodeVal = watch('parentCode');
  const derivedLevel = useMemo(() => {
    if (!parentCodeVal || parentCodeVal === 'none') return 'MAIN';
    const parentAcc = allAccounts.find(a => a.code === parentCodeVal);
    if (!parentAcc) return 'SUBSIDIARY';
    return parentAcc.level === 'MAIN' ? 'PARENT' : 'SUBSIDIARY';
  }, [parentCodeVal, allAccounts]);

  // Auto-suggest a GL code based on parent and siblings
  const suggestCode = () => {
    if (!parentCodeVal || parentCodeVal === 'none') {
      const mainAccounts = allAccounts.filter((a) => a.level === 'MAIN' && a.type === watch('type'));
      const numericCodes = mainAccounts.map((a) => parseInt(a.code, 10)).filter(Number.isFinite);
      const max = numericCodes.length ? Math.max(...numericCodes) : null;
      let suggestion = max ? String(max + 1000000).substring(0, 1) + '000000' : '';
      if (!suggestion) {
        if (watch('type') === 'Asset') suggestion = '1000000';
        else if (watch('type') === 'Liability') suggestion = '2000000';
        else if (watch('type') === 'Equity') suggestion = '3000000';
        else if (watch('type') === 'Revenue') suggestion = '4000000';
        else suggestion = '5000000';
      }
      setValue('code', suggestion.padEnd(7, '0'));
    } else {
      const siblings = allAccounts.filter(a => a.parentCode === parentCodeVal);
      const sibNumeric = siblings.map(a => parseInt(a.code, 10)).filter(Number.isFinite);
      const sibMax = sibNumeric.length ? Math.max(...sibNumeric) : parseInt(parentCodeVal, 10);
      setValue('code', String(sibMax + 1).padStart(7, '0'));
    }
  };

  const onSubmitForm = async (data) => {
    // Check code uniqueness
    const codeExists = allAccounts.some(
      (acc) => acc.code === data.code && (!editingAccount || acc.id !== editingAccount.id)
    );

    if (codeExists) {
      setError('code', { type: 'manual', message: 'Account code is already in use' });
      return;
    }

    const formattedData = {
      ...data,
      parentCode: data.parentCode === 'none' ? null : data.parentCode,
    };

    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, formattedData);
        logActivity(
          'Modify Account',
          `Modified Account ${editingAccount.code} - ${editingAccount.name}.`
        );
        alert('Account updated successfully');
      } else {
        const created = await addAccount(formattedData);
        logActivity(
          'Create Account',
          `Created Account ${created.glCode || formattedData.code} - ${created.accountName || formattedData.name}.`
        );
        alert('Account created successfully');
      }
      onClose();
    } catch (e) {
      alert(e.message || "An error occurred");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAccount ? `Edit Account: ${editingAccount.code}` : "Create New Account"}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-5">
        
        {/* Row 1: Code and Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label="Account Code"
              required
              error={errors.code?.message}
              placeholder="e.g. 1115"
              disabled={!!(editingAccount && editingAccount.isLocked)}
              {...register('code')}
            />
            {!editingAccount && (
              <div className="flex items-center gap-2 mt-2">
                <button type="button" onClick={suggestCode} className="text-xs text-slate-400 hover:text-slate-200">Suggest Code</button>
                <span className="text-[11px] text-slate-500">or enter manually</span>
              </div>
            )}
          </div>
          <Input
            label="Account Name"
            required
            error={errors.name?.message}
            placeholder="e.g. Petty Cash - Marketing"
            disabled={!!(editingAccount && editingAccount.isLocked)}
            {...register('name')}
          />
        </div>

        {/* Row 2: Type and Subtype */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Account Type"
            required
            error={errors.type?.message}
            disabled={!!(editingAccount && editingAccount.isLocked)}
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
            required
            error={errors.detailType?.message}
            disabled={!!(editingAccount && editingAccount.isLocked)}
            {...register('detailType')}
          >
            {(detailTypeOptions[selectedType] || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Select>
        </div>

        {/* Row 3: Parent Account and Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Parent Account"
            error={errors.parentCode?.message}
            disabled={!!(editingAccount && editingAccount.isLocked)}
            {...register('parentCode')}
          >
            {potentialParents.map((parent) => (
              <option key={parent.code} value={parent.code}>
                {parent.code} - {parent.name} ({parent.detailType})
              </option>
            ))}
          </Select>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Account Level</label>
            <input 
              value={derivedLevel}
              disabled
              className="w-full px-3 py-2 rounded-lg bg-slate-900/40 border border-slate-800 text-slate-500 text-sm cursor-not-allowed font-semibold"
            />
          </div>

          <Select
            label="Currency"
            required
            error={errors.currency?.message}
            disabled={!!(editingAccount && editingAccount.isLocked)}
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

        {/* Row 4: Initial Balance (only show on new account creation) */}
        {!editingAccount && (
          <Input
            label="Initial Balance"
            type="number"
            step="0.01"
            error={errors.initialBalance?.message}
            description="If you are transitioning ledger balances, enter the starting balance."
            {...register('initialBalance')}
          />
        )}

        {/* Locked / Reserved toggles */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={!!(editingAccount && editingAccount.isLocked)} {...register('isLocked')} />
            <span className="text-sm text-slate-400">Is Locked</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" disabled={!!(editingAccount && editingAccount.isLocked)} {...register('isReserved')} />
            <span className="text-sm text-slate-400">Is Reserved</span>
          </label>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Description
          </label>
          <textarea
            rows="3"
            disabled={!!(editingAccount && editingAccount.isLocked)}
            placeholder="Add detailed explanation of this account's purpose..."
            className={`
              w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-md text-sm text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all duration-200
              ${errors.description ? 'border-red-500/50' : ''}
              ${editingAccount && editingAccount.isLocked ? 'cursor-not-allowed opacity-70' : ''}
            `}
            {...register('description')}
          />
          {errors.description && (
            <span className="text-xs text-red-400">⚠️ {errors.description.message}</span>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/80">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {editingAccount ? 'Save Changes' : 'Create Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
