import React from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';

export const Reports = () => {
  return (
    <DashboardLayout breadcrumbs={["Reports"]}>
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6">
        <h3 className="text-lg font-bold text-slate-100">Reports</h3>
        <p className="text-sm text-slate-400 mt-2">Placeholder for financial and operational reports (interactive charts, exports).</p>
      </div>
    </DashboardLayout>
  );
}
