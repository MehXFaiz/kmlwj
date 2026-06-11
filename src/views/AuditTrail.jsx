import React, { useState, useMemo } from 'react';
import { useJournalStore } from '../store/journalStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { History, ShieldCheck, Search, HelpCircle, Terminal } from 'lucide-react';

export const AuditTrail = () => {
  const { auditLogs } = useJournalStore();
  const [searchQuery, setSearchQuery] = useState('');

  const getActionBadgeVariant = (action) => {
    switch (action) {
      case 'Create Account':
        return 'success';
      case 'Modify Account':
        return 'warning';
      case 'Post Journal':
        return 'brand';
      default:
        return 'default';
    }
  };

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        log.user.toLowerCase().includes(query)
      );
    });
  }, [auditLogs, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wider font-sans">SOX Audit Trail Logs</h2>
        <p className="text-xs text-slate-400">Strict internal control modifications tracker to guarantee regulatory compliance.</p>
      </div>

      {/* Info Warning */}
      <div className="flex items-start gap-3 p-3 sm:p-4 bg-blue-950/20 border border-blue-900/40 rounded-xl">
        <ShieldCheck className="h-5 w-5 text-brand-400 flex-shrink-0" />
        <p className="text-xs text-slate-400 leading-relaxed">
          The Sarbanes-Oxley Act requires all journal changes, chart of account changes, and financial modifications to be logged in a read-only trial.
          This sandbox records all user actions with UTC timestamps.
        </p>
      </div>

      {/* Search Filter bar */}
      <Card>
        <CardContent className="p-0">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search audit actions or log details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg text-sm py-2 pl-10 pr-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Log list */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Compliance Logs</CardTitle>
            <CardDescription>Chronological trial trace.</CardDescription>
          </div>
          <History className="h-5 w-5 text-slate-600" />
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase bg-slate-900/10">
                <th className="py-2.5 px-3 w-48">Timestamp (UTC)</th>
                <th className="py-2.5 px-3 w-40">Action</th>
                <th className="py-2.5 px-3">Compliance Details</th>
                <th className="py-2.5 px-3 w-36">Authorized User</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-800/40 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500 italic">
                    No compliance events match the search queries.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const formattedTime = new Date(log.timestamp).toLocaleString();
                  return (
                    <tr key={log.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-3 px-3 text-slate-400">{formattedTime}</td>
                      <td className="py-3 px-3">
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-slate-200 font-sans">{log.details}</td>
                      <td className="py-3 px-3 text-brand-300 font-bold">{log.user}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
