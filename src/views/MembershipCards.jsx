import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMemberStore } from '../store/memberStore';
import { CardFront, CardBack } from '../components/members/MembershipCard';
import {
  CreditCard, Search, Printer, Download, ChevronLeft,
  Users, RefreshCw, Grid3X3, LayoutList, X, Check, Eye, Filter
} from 'lucide-react';

/* ── Org constants ── */
const ORG_NAME_SHORT = 'KMLWJ';

/* ── Print styles injected once ── */
const PRINT_STYLES = `
@media print {
  @page { margin: 0; size: auto; }
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: fixed; left: 0; top: 0; width: 100%; height: 100%; }
}
`;

function injectPrintStyles() {
  if (document.getElementById('mc-print-styles')) return;
  const style = document.createElement('style');
  style.id = 'mc-print-styles';
  style.textContent = PRINT_STYLES;
  document.head.appendChild(style);
}

/* ── CR80 dimensions: 85.60mm × 53.98mm ── */
const CARD_W_MM = 85.6;
const CARD_H_MM = 53.98;

/* ─────────── Single-card print layout ─────────── */
function SingleCardPrintArea({ member, areaRef }) {
  return (
    <div id="print-area" ref={areaRef} style={{
      position: 'fixed', left: '-9999px', top: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '4mm',
      width: '100mm', padding: '4mm',
      fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
    }}>
      {/* Front */}
      <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column' }}>
        <CardFront member={member} />
      </div>
      {/* Back */}
      <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column' }}>
        <CardBack member={member} />
      </div>
    </div>
  );
}

/* ─────────── A4 bulk print layout (4 cards per page, front+back pairs) ─────────── */
function A4PrintArea({ members, areaRef }) {
  // 4 cards per page arranged as 2×2 grid on A4 (210mm × 297mm)
  return (
    <div id="print-area" ref={areaRef} style={{
      position: 'fixed', left: '-9999px', top: 0,
      fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
    }}>
      {chunk(members, 4).map((group, pageIdx) => (
        <div key={pageIdx} style={{
          width: '210mm', height: '297mm',
          padding: '8mm',
          display: 'grid',
          gridTemplateRows: `${CARD_H_MM}mm 6mm ${CARD_H_MM}mm`,
          gridTemplateColumns: `${CARD_W_MM}mm 5mm ${CARD_W_MM}mm`,
          pageBreakAfter: 'always',
          boxSizing: 'border-box',
        }}>
          {group.slice(0, 2).map((m, i) => (
            <React.Fragment key={m.id}>
              {/* Front */}
              <div style={{
                gridRow: 1, gridColumn: i === 0 ? 1 : 3,
                width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`,
                display: 'flex', flexDirection: 'column'
              }}>
                <CardFront member={m} />
              </div>
            </React.Fragment>
          ))}
          {/* Gap row */}
          <div style={{ gridRow: 2, gridColumn: '1 / -1' }} />
          {group.slice(0, 2).map((m, i) => (
            <React.Fragment key={`back-${m.id}`}>
              {/* Back */}
              <div style={{
                gridRow: 3, gridColumn: i === 0 ? 1 : 3,
                width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`,
                display: 'flex', flexDirection: 'column'
              }}>
                <CardBack member={m} />
              </div>
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ─────────── Preview modal ─────────── */
function PreviewModal({ member, onClose, onPrint }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#111', borderRadius: '16px',
        border: '1px solid #333',
        padding: '28px',
        maxWidth: '480px', width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Membership Card Preview</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{member.fullName} • {member.memberNo || 'No ID'}</div>
          </div>
          <button onClick={onClose} style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#94a3b8'
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Card previews */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: '#64748b', alignSelf: 'flex-start', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Front</div>
          <div style={{ width: '320px', height: '202px', display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            <CardFront member={member} />
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', alignSelf: 'flex-start', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '6px' }}>Back</div>
          <div style={{ width: '320px', height: '202px', display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            <CardBack member={member} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            background: '#1e293b', border: '1px solid #334155',
            color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: 600
          }}>
            Close
          </button>
          <button onClick={() => onPrint(member)} style={{
            flex: 2, padding: '10px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)',
            border: '1px solid #C9A22788',
            color: '#C9A227', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}>
            <Printer size={15} />
            Print Card
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ MAIN VIEW ═══════════════════════ */
export const MembershipCards = () => {
  const { members, fetchMembers, loading } = useMemberStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | active | inactive
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewMember, setPreviewMember] = useState(null);
  const [printMode, setPrintMode] = useState(null); // 'single' | 'a4-bulk'
  const [printMember, setPrintMember] = useState(null);
  const [view, setView] = useState('grid'); // grid | list
  const singlePrintRef = useRef(null);
  const bulkPrintRef = useRef(null);

  useEffect(() => {
    injectPrintStyles();
    fetchMembers();
  }, [fetchMembers]);

  /* ── Filtering ── */
  const filtered = members.filter(m => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      (m.fullName?.toLowerCase().includes(term)) ||
      (m.memberNo?.toLowerCase().includes(term)) ||
      (m.cnic?.toLowerCase().includes(term)) ||
      (m.mobile?.toLowerCase().includes(term)) ||
      (m.ghamName?.toLowerCase().includes(term));
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? m.isActive : !m.isActive);
    return matchSearch && matchStatus;
  });

  /* ── Selection ── */
  const toggleSelect = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const selectAll = () => setSelectedIds(filtered.map(m => m.id));
  const clearAll = () => setSelectedIds([]);
  const selectedMembers = members.filter(m => selectedIds.includes(m.id));

  /* ── Print helpers ── */
  const triggerPrint = useCallback(() => {
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(null), 500);
    }, 200);
  }, []);

  const printSingle = useCallback((member) => {
    setPreviewMember(null);
    setPrintMember(member);
    setPrintMode('single');
    setTimeout(triggerPrint, 300);
  }, [triggerPrint]);

  const printBulk = useCallback(() => {
    if (selectedIds.length === 0) return;
    setPrintMode('a4-bulk');
    setTimeout(triggerPrint, 300);
  }, [selectedIds, triggerPrint]);

  /* ─────────── RENDER ─────────── */
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div style={{
            padding: '10px', borderRadius: '12px',
            background: 'rgba(13,78,43,0.15)', border: '1px solid rgba(13,78,43,0.4)'
          }}>
            <CreditCard size={22} color="#4ade80" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">Membership Cards</h1>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#C9A227',
                background: 'rgba(201,162,39,0.1)', padding: '2px 10px',
                borderRadius: '999px', border: '1px solid rgba(201,162,39,0.25)'
              }}>
                {members.length} Members
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate, preview and print CR80 ID cards for all members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {selectedIds.length > 0 && (
            <button
              onClick={printBulk}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 16px', borderRadius: '10px', cursor: 'pointer',
                background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)',
                border: '1.5px solid rgba(201,162,39,0.5)',
                color: '#C9A227', fontSize: '13px', fontWeight: 700,
                boxShadow: '0 4px 12px rgba(13,78,43,0.4)'
              }}
            >
              <Printer size={15} />
              Print {selectedIds.length} Cards (A4)
            </button>
          )}
          <button
            onClick={() => fetchMembers()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold hover:border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link
            to="/members/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-lg active:scale-95 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)', border: '1px solid rgba(201,162,39,0.4)', color: '#C9A227' }}
          >
            <Users size={14} />
            Manage Members
          </Link>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by Name, Member No, CNIC, Mobile, Gham..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-green-700/50 transition-colors"
          />
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value="all">All Members</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Select all / clear */}
        {filtered.length > 0 && (
          <button
            onClick={selectedIds.length === filtered.length ? clearAll : selectAll}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:border-slate-700 transition-all cursor-pointer"
          >
            <div style={{
              width: '14px', height: '14px', borderRadius: '3px',
              border: '2px solid',
              borderColor: selectedIds.length === filtered.length ? '#C9A227' : '#475569',
              background: selectedIds.length === filtered.length ? '#C9A227' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {selectedIds.length === filtered.length && <Check size={9} color="#000" strokeWidth={3} />}
            </div>
            {selectedIds.length === filtered.length ? `Deselect All` : `Select All (${filtered.length})`}
          </button>
        )}

        {selectedIds.length > 0 && (
          <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
            Clear ({selectedIds.length})
          </button>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-auto bg-slate-900 border border-slate-800 rounded-xl p-1">
          {[['grid', <Grid3X3 size={14} />], ['list', <LayoutList size={14} />]].map(([v, icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
                background: view === v ? 'rgba(13,78,43,0.4)' : 'transparent',
                color: view === v ? '#4ade80' : '#64748b',
                border: view === v ? '1px solid rgba(74,222,128,0.2)' : '1px solid transparent',
                transition: 'all 0.15s'
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Members', value: members.length, color: '#C9A227' },
          { label: 'Active', value: members.filter(m => m.isActive).length, color: '#4ade80' },
          { label: 'With Photo', value: members.filter(m => m.photoUrl).length, color: '#60a5fa' },
          { label: 'Selected', value: selectedIds.length, color: '#f472b6' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#0f0f0f', border: '1px solid #1e293b',
            borderRadius: '12px', padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: '2px'
          }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Card / List grid ── */}
      {loading ? (
        <div className="py-24 flex items-center justify-center">
          <RefreshCw size={32} className="animate-spin text-slate-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#0f0f0f', border: '1px solid #1e293b',
          borderRadius: '16px', padding: '60px 20px', textAlign: 'center'
        }}>
          <CreditCard size={40} color="#334155" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#475569', fontSize: '15px', fontWeight: 600 }}>No members found</div>
          <div style={{ color: '#334155', fontSize: '12px', marginTop: '6px' }}>
            {searchTerm ? 'Try a different search term' : 'Register members first to generate cards'}
          </div>
          <Link to="/members/new" style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            marginTop: '16px', padding: '9px 20px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)',
            border: '1px solid rgba(201,162,39,0.4)',
            color: '#C9A227', fontSize: '13px', fontWeight: 700, textDecoration: 'none'
          }}>
            <Users size={14} />
            Register Member
          </Link>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(member => (
            <MemberCardTile
              key={member.id}
              member={member}
              selected={selectedIds.includes(member.id)}
              onToggle={() => toggleSelect(member.id)}
              onPreview={() => setPreviewMember(member)}
              onPrint={() => printSingle(member)}
            />
          ))}
        </div>
      ) : (
        <MemberListView
          members={filtered}
          selectedIds={selectedIds}
          onToggle={toggleSelect}
          onPreview={setPreviewMember}
          onPrint={printSingle}
        />
      )}

      {/* ── Preview Modal ── */}
      {previewMember && (
        <PreviewModal
          member={previewMember}
          onClose={() => setPreviewMember(null)}
          onPrint={printSingle}
        />
      )}

      {/* ── Hidden print areas ── */}
      {printMode === 'single' && printMember && (
        <SingleCardPrintArea member={printMember} areaRef={singlePrintRef} />
      )}
      {printMode === 'a4-bulk' && selectedMembers.length > 0 && (
        <A4PrintArea members={selectedMembers} areaRef={bulkPrintRef} />
      )}
    </div>
  );
};

/* ─────────── Card tile ─────────── */
function MemberCardTile({ member, selected, onToggle, onPreview, onPrint }) {
  const initials = (member.fullName || 'M').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{
      background: '#0f0f0f',
      border: selected ? '1.5px solid rgba(201,162,39,0.7)' : '1px solid #1e293b',
      borderRadius: '14px', padding: '16px',
      transition: 'all 0.2s',
      boxShadow: selected ? '0 0 0 3px rgba(201,162,39,0.1)' : 'none',
      display: 'flex', flexDirection: 'column', gap: '12px',
      cursor: 'pointer',
    }}
      onClick={onToggle}
    >
      {/* Top: Photo + select + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{
          width: '48px', height: '56px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0,
          border: '2px solid rgba(201,162,39,0.3)',
          background: 'linear-gradient(135deg, #0D4E2B, #0A3D21)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {member.photoUrl
            ? <img src={member.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#C9A227', fontWeight: 800, fontSize: '15px' }}>{initials}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {member.fullName}
          </div>
          <div style={{ fontSize: '11px', color: '#C9A227', fontWeight: 600, marginTop: '2px' }}>
            {member.memberNo || 'No Member No.'}
          </div>
          <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: member.isActive ? '#4ade80' : '#64748b',
              background: member.isActive ? 'rgba(74,222,128,0.1)' : 'rgba(100,116,139,0.1)',
              border: `1px solid ${member.isActive ? 'rgba(74,222,128,0.2)' : 'rgba(100,116,139,0.15)'}`,
              padding: '1px 6px', borderRadius: '999px'
            }}>
              {member.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        {/* Checkbox */}
        <div style={{
          width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
          border: selected ? '2px solid #C9A227' : '2px solid #334155',
          background: selected ? '#C9A227' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s'
        }}
          onClick={e => { e.stopPropagation(); onToggle(); }}
        >
          {selected && <Check size={11} color="#000" strokeWidth={3} />}
        </div>
      </div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {[
          ['CNIC', member.cnic],
          ['Gham', member.ghamName],
          ['Mobile', member.mobile],
        ].map(([label, val]) => val && (
          <div key={label} style={{ display: 'flex', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', minWidth: '40px', fontWeight: 600 }}>{label}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '2px' }}>
        <button
          onClick={e => { e.stopPropagation(); onPreview(); }}
          style={{
            flex: 1, padding: '7px', borderRadius: '8px', cursor: 'pointer',
            background: '#1e293b', border: '1px solid #334155',
            color: '#94a3b8', fontSize: '11px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            transition: 'all 0.15s'
          }}
        >
          <Eye size={12} />
          Preview
        </button>
        <button
          onClick={e => { e.stopPropagation(); onPrint(); }}
          style={{
            flex: 1, padding: '7px', borderRadius: '8px', cursor: 'pointer',
            background: 'rgba(13,78,43,0.25)',
            border: '1px solid rgba(201,162,39,0.3)',
            color: '#C9A227', fontSize: '11px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            transition: 'all 0.15s'
          }}
        >
          <Printer size={12} />
          Print
        </button>
      </div>
    </div>
  );
}

/* ─────────── List view ─────────── */
function MemberListView({ members, selectedIds, onToggle, onPreview, onPrint }) {
  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #1e293b', borderRadius: '14px', overflow: 'hidden' }}>
      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '32px 44px 1fr 130px 130px 100px 140px',
        padding: '10px 16px', borderBottom: '1px solid #1e293b',
        background: '#080808'
      }}>
        {['', '', 'Member', 'Member No.', 'CNIC', 'Gham', 'Actions'].map((h, i) => (
          <span key={i} style={{ fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
        ))}
      </div>
      {members.map((m, idx) => {
        const selected = selectedIds.includes(m.id);
        const initials = (m.fullName || 'M').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        return (
          <div key={m.id} style={{
            display: 'grid', gridTemplateColumns: '32px 44px 1fr 130px 130px 100px 140px',
            padding: '10px 16px', borderBottom: idx < members.length - 1 ? '1px solid #1e293b' : 'none',
            alignItems: 'center',
            background: selected ? 'rgba(201,162,39,0.04)' : 'transparent',
            transition: 'background 0.15s'
          }}>
            {/* Checkbox */}
            <div
              style={{
                width: '16px', height: '16px', borderRadius: '3px',
                border: selected ? '2px solid #C9A227' : '2px solid #334155',
                background: selected ? '#C9A227' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
              onClick={() => onToggle(m.id)}
            >
              {selected && <Check size={10} color="#000" strokeWidth={3} />}
            </div>
            {/* Photo */}
            <div style={{
              width: '32px', height: '38px', borderRadius: '5px', overflow: 'hidden',
              border: '1.5px solid rgba(201,162,39,0.25)',
              background: 'linear-gradient(135deg, #0D4E2B, #0A3D21)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {m.photoUrl
                ? <img src={m.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: '#C9A227', fontWeight: 800, fontSize: '11px' }}>{initials}</span>
              }
            </div>
            {/* Name */}
            <div style={{ paddingLeft: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{m.fullName}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{m.fatherName ? `s/o ${m.fatherName}` : ''}</div>
            </div>
            {/* Member No */}
            <span style={{ fontSize: '12px', color: '#C9A227', fontWeight: 600 }}>{m.memberNo || '—'}</span>
            {/* CNIC */}
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{m.cnic || '—'}</span>
            {/* Gham */}
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{m.ghamName || '—'}</span>
            {/* Actions */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => onPreview(m)}
                style={{
                  padding: '5px 8px', borderRadius: '7px', cursor: 'pointer',
                  background: '#1e293b', border: '1px solid #334155',
                  color: '#94a3b8', fontSize: '11px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Eye size={11} />
                View
              </button>
              <button
                onClick={() => onPrint(m)}
                style={{
                  padding: '5px 8px', borderRadius: '7px', cursor: 'pointer',
                  background: 'rgba(13,78,43,0.25)', border: '1px solid rgba(201,162,39,0.3)',
                  color: '#C9A227', fontSize: '11px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Printer size={11} />
                Print
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
