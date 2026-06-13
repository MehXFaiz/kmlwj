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
    .min(3, "Account code must be at least 3 digits")
    .max(10, "Account code is too long")
    .regex(/^\d+$/, "Account code must contain numbers only"),
  name: zod.string()
    .min(3, "Account name must be at least 3 characters")
    .max(80, "Account name is too long"),
  type: zod.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']),
  detailType: zod.string().min(1, "Detail type is required"),
  parentCode: zod.string().nullable().optional(),
  level: zod.number().min(0).max(10).optional(),
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
      parentCode: 'none',
      level: 1,
      isLocked: false,
      isReserved: false,
      currency: 'USD',
      description: '',
      initialBalance: 0,
    },
  });

  const selectedType = watch('type');

  // Fill detailType defaults when type changes
  useEffect(() => {
    if (!editingAccount) {
      const options = detailTypeOptions[selectedType] || [];
      if (options.length > 0) {
        setValue('detailType', options[0]);
      }
    }
  }, [selectedType, setValue, editingAccount]);

  // Load account data for editing
  useEffect(() => {
    if (editingAccount) {
      reset({
        code: editingAccount.code,
        name: editingAccount.name,
        type: editingAccount.type,
        detailType: editingAccount.detailType,
        parentCode: editingAccount.parentCode || 'none',
        currency: editingAccount.currency,
        description: editingAccount.description || '',
        initialBalance: editingAccount.initialBalance || 0,
      });
    } else {
      reset({
        code: '',
        name: '',
        type: 'Asset',
        detailType: 'Cash',
        parentCode: 'none',
        currency: 'USD',
        description: '',
        initialBalance: 0,
      });
    }
  }, [editingAccount, reset, isOpen]);

  // Filter possible parents: must be the same account type (or header type) and not self
  const potentialParents = allAccounts.filter((acc) => {
    if (editingAccount && acc.id === editingAccount.id) return false; // cannot be own parent
    
    // Parent should be of same Type (e.g. Asset parent for Asset child)
    // AND parent should be a "Header" or have detailType "Header" for best practice,
    // though in standard accounts we can nest under any account.
    return acc.type === selectedType && (acc.detailType === 'Header' || acc.parentCode === null);
  });

  // Auto-suggest a GL code based on same-type highest code
  const suggestCode = () => {
    const sameType = allAccounts.filter((a) => a.type === watch('type'));
    const numericCodes = sameType.map((a) => parseInt(a.code, 10)).filter(Number.isFinite);
    const max = numericCodes.length ? Math.max(...numericCodes) : null;
    const suggestion = max ? String(max + 1) : (watch('type') === 'Asset' ? '1000' : '4000');
    setValue('code', suggestion);
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
            {...register('name')}
          />
        </div>

        {/* Row 2: Type and Subtype */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Account Type"
            required
            error={errors.type?.message}
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
            {...register('parentCode')}
          >
            <option value="none">-- No Parent (Root Account) --</option>
            {potentialParents.map((parent) => (
              <option key={parent.code} value={parent.code}>
                {parent.code} - {parent.name} ({parent.detailType})
              </option>
            ))}
          </Select>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Account Level</label>
            <select {...register('level')} className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-200 text-sm">
              {[1,2,3,4,5,6].map(l => <option key={l} value={l}>Level {l}</option>)}
            </select>
          </div>

          <Select
            label="Currency"
            required
            error={errors.currency?.message}
            {...register('currency')}
          >
            <option value="USD">USD - US Dollar</option>
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
            placeholder="Add detailed explanation of this account's purpose..."
            className={`
              w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-md text-sm text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all duration-200
              ${errors.description ? 'border-red-500/50' : ''}
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
