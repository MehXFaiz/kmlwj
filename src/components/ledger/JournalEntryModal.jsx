import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useCoaStore } from '../../store/coaStore';
import { useJournalStore } from '../../store/journalStore';

// Zod validation for single line
const journalLineSchema = zod.object({
  accountCode: zod.string().min(1, "Select an account"),
  description: zod.string().optional(),
  debit: zod.preprocess((val) => Number(val) || 0, zod.number().min(0)),
  credit: zod.preprocess((val) => Number(val) || 0, zod.number().min(0)),
});

// Zod validation for whole journal
const journalSchema = zod.object({
  date: zod.string().min(1, "Date is required"),
  subsidiary: zod.string().min(1, "Subsidiary is required"),
  reference: zod.string().min(3, "Reference must be at least 3 characters").max(100),
  lines: zod.array(journalLineSchema).min(2, "Journal entry must have at least 2 lines"),
});

export const JournalEntryModal = ({ isOpen, onClose }) => {
  const { accounts, selectedSubsidiary } = useCoaStore();
  const { addJournalEntry } = useJournalStore();
  const [success, setSuccess] = useState(false);

  const activePostingAccounts = accounts.filter(
    (acc) => acc.status === 'Active' && acc.detailType !== 'Header'
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      subsidiary: selectedSubsidiary === 'Global' ? 'Acme US' : selectedSubsidiary,
      reference: '',
      lines: [
        { accountCode: '', description: '', debit: 0, credit: 0 },
        { accountCode: '', description: '', debit: 0, credit: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const watchLines = watch('lines');

  // Calculate Running Totals
  const totalDebits = watchLines?.reduce((sum, line) => sum + (Number(line.debit) || 0), 0) || 0;
  const totalCredits = watchLines?.reduce((sum, line) => sum + (Number(line.credit) || 0), 0) || 0;
  const imbalance = Math.abs(totalDebits - totalCredits);
  const isBalanced = totalDebits > 0 && imbalance < 0.01;

  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      reset({
        date: new Date().toISOString().split('T')[0],
        subsidiary: selectedSubsidiary === 'Global' ? 'Acme US' : selectedSubsidiary,
        reference: '',
        lines: [
          { accountCode: '', description: '', debit: 0, credit: 0 },
          { accountCode: '', description: '', debit: 0, credit: 0 },
        ],
      });
    }
  }, [isOpen, reset, selectedSubsidiary]);

  const onSubmitForm = async (data) => {
    if (!isBalanced) {
      alert("Double-entry accounting error: Debits and credits must balance!");
      return;
    }
    
    // Additional validation: cannot have both debit and credit on the same line
    const invalidLine = data.lines.some(l => l.debit > 0 && l.credit > 0);
    if (invalidLine) {
      alert("Validation error: A line cannot contain both a Debit and a Credit.");
      return;
    }

    const res = await addJournalEntry(data);
    if (res && res.error) {
      alert("Error posting journal: " + res.error);
      return;
    }
    
    setSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Journal Entry"
      size="xl"
    >
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 animate-bounce" />
          <h4 className="text-base font-bold text-slate-100">Journal Entry Posted</h4>
          <p className="text-xs text-slate-400">
            The transactions have been recorded. Dynamic ledger balances updated.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
          {/* Header Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Transaction Date"
              type="date"
              required
              error={errors.date?.message}
              {...register('date')}
            />

            <Select
              label="Subsidiary / Entity"
              required
              error={errors.subsidiary?.message}
              {...register('subsidiary')}
            >
              <option value="Acme US">Acme US</option>
              <option value="Acme Europe">Acme Europe</option>
              <option value="Acme APAC">Acme APAC</option>
            </Select>

            <Input
              label="Memo / Reference"
              required
              placeholder="e.g. Accrued Payroll May"
              error={errors.reference?.message}
              {...register('reference')}
            />
          </div>

          {/* Grid lines */}
          <div className="space-y-3">
            <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Transaction Lines
              </h5>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ accountCode: '', description: '', debit: 0, credit: 0 })}
                className="gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Row</span>
              </Button>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden overflow-x-auto bg-slate-950/20">
              <table className="w-full text-left border-collapse min-w-[520px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase bg-slate-900/35">
                    <th className="py-2.5 px-3 w-72">Account</th>
                    <th className="py-2.5 px-3">Description / Memo</th>
                    <th className="py-2.5 px-3 w-40">Debit ($)</th>
                    <th className="py-2.5 px-3 w-40">Credit ($)</th>
                    <th className="py-2.5 px-3 w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fields.map((field, index) => {
                    const rowErrors = errors.lines?.[index];

                    return (
                      <tr key={field.id} className="hover:bg-slate-900/10">
                        {/* Select Account */}
                        <td className="py-2 px-2">
                          <select
                            {...register(`lines.${index}.accountCode`)}
                            className={`
                              w-full px-2 py-1.5 bg-slate-900 border text-xs text-slate-100 rounded-md
                              focus:outline-none focus:ring-1 focus:ring-brand-500
                              ${rowErrors?.accountCode ? 'border-red-500/50' : 'border-slate-800'}
                            `}
                          >
                            <option value="">-- Choose Account --</option>
                            {activePostingAccounts.map((acc) => (
                              <option key={acc.code} value={acc.code}>
                                {acc.code} - {acc.name} ({acc.type})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Description */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            placeholder="Line details..."
                            {...register(`lines.${index}.description`)}
                            className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </td>

                        {/* Debit */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...register(`lines.${index}.debit`)}
                            className={`
                              w-full px-2 py-1.5 bg-slate-900 border text-xs text-slate-100 rounded-md text-right font-mono
                              focus:outline-none focus:ring-1 focus:ring-brand-500
                              ${rowErrors?.debit ? 'border-red-500/50' : 'border-slate-800'}
                            `}
                          />
                        </td>

                        {/* Credit */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...register(`lines.${index}.credit`)}
                            className={`
                              w-full px-2 py-1.5 bg-slate-900 border text-xs text-slate-100 rounded-md text-right font-mono
                              focus:outline-none focus:ring-1 focus:ring-brand-500
                              ${rowErrors?.credit ? 'border-red-500/50' : 'border-slate-800'}
                            `}
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-2 text-center">
                          {fields.length > 2 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800/40 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {errors.lines?.message && (
              <span className="text-xs text-red-400 block mt-1">
                ⚠️ {errors.lines.message}
              </span>
            )}
          </div>

          {/* Validation Banner / Status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800">
            {/* Equivalence check */}
            <div className="flex items-center gap-3">
              {isBalanced ? (
                <div className="h-8 w-8 rounded-full bg-emerald-950 flex items-center justify-center border border-emerald-800/50 flex-shrink-0">
                  <span className="text-emerald-400 text-xs">✓</span>
                </div>
              ) : (
                <div className="h-8 w-8 rounded-full bg-amber-950 flex items-center justify-center border border-amber-800/50 flex-shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-300">
                  {isBalanced ? 'Journal is Balanced' : 'Journal is Out of Balance'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Difference: ${imbalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Total Indicators */}
            <div className="flex gap-6 text-right">
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Debits</span>
                <span className="font-mono text-sm font-bold text-slate-200">
                  ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Credits</span>
                <span className="font-mono text-sm font-bold text-slate-200">
                  ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
            <div className="flex flex-wrap justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1 sm:flex-none justify-center">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isBalanced}
              className="flex-1 sm:flex-none justify-center"
            >
              Post Journal Entry
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
