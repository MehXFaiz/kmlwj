import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Link2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { showToast } from '../components/ui/Toast';
import { useAddIncomeStore } from '../store/addIncomeStore';
import { useCoaStore } from '../store/coaStore';

// Accounting Settings > Income Category Mapping — the dedicated admin screen
// for what api/_v1/add-income.ts now enforces server-side: every Income
// Category must reference a real Revenue GL leaf account before it can be
// used to record income. This page lets an admin see and change that mapping
// directly (Income Category | Mapped GL Account | GL Code | Status), reusing
// the existing PUT /api/v1/income-categories endpoint — no new backend route.
export const IncomeCategoryMapping = () => {
  const { categories, categoriesLoading, fetchCategories, updateCategory } = useAddIncomeStore();
  const { flatAccounts, fetchAccountsList } = useCoaStore();
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchAccountsList();
  }, [fetchCategories, fetchAccountsList]);

  // Only real, postable Revenue accounts are valid mapping targets — mapping
  // a category to a header or a non-Revenue account would just reproduce the
  // "Account not found" style failure one level later.
  const revenueLeafAccounts = useMemo(
    () => (flatAccounts || [])
      .filter((a) => a.type === 'Revenue' && a.level === 'GL')
      .sort((a, b) => String(a.code).localeCompare(String(b.code))),
    [flatAccounts]
  );

  const handleRemap = async (category, accountId) => {
    setSavingId(category.id);
    try {
      await updateCategory(category.id, { accountId: accountId || null });
      showToast(
        accountId
          ? `${category.name} mapped successfully.`
          : `${category.name} mapping removed — income can't be recorded against it until it's mapped again.`,
        accountId ? 'success' : 'warning'
      );
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.message || 'Failed to update mapping', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wider">Income Category Mapping</h2>
        <p className="text-xs text-slate-400">
          Every Income Category must reference an existing Revenue GL Account. Income cannot be recorded
          against an unmapped category — the Add Income form will show a clear message until it's mapped here.
        </p>
      </div>

      <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-slate-900/80 border-b-2 border-slate-700 text-slate-300 font-bold tracking-wider text-xs uppercase">
                  <th className="py-3 px-4">Income Category</th>
                  <th className="py-3 px-4 min-w-[260px]">Mapped GL Account</th>
                  <th className="py-3 px-4 w-32">GL Code</th>
                  <th className="py-3 px-4 w-32 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {categoriesLoading && categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Loading categories…
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">No income categories found.</td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const isMapped = Boolean(cat.account?.id || cat.accountId);
                    return (
                      <tr key={cat.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-200">{cat.name}</td>
                        <td className="py-3 px-4">
                          <select
                            value={cat.account?.id || ''}
                            disabled={savingId === cat.id}
                            onChange={(e) => handleRemap(cat, e.target.value)}
                            className="w-full max-w-xs px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-700/60 text-xs text-slate-100 focus:outline-none focus:border-brand-500/70 disabled:opacity-50 cursor-pointer"
                          >
                            <option value="">— Not mapped —</option>
                            {revenueLeafAccounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">{cat.account?.glCode || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          {isMapped ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/30 text-emerald-300 border border-emerald-900/40">
                              <CheckCircle2 className="h-3 w-3" /> Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/30 text-amber-300 border border-amber-900/40">
                              <AlertTriangle className="h-3 w-3" /> Unmapped
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-800 flex items-center gap-2 text-[11px] text-slate-500">
            <Link2 className="h-3.5 w-3.5" />
            Changing a mapping here takes effect immediately for the next income record saved against that category — existing posted entries are not retroactively changed.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
