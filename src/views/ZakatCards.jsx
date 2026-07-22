import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useZakatCardStore } from '../store/zakatCardStore';
import { zakatCardService } from '../services/zakatCardService';
import { useAuthStore } from '../store/authStore';
import { ZakatCardFront, ZakatCardBack } from '../components/members/ZakatCard';
import { PvcCardPrintView } from '../components/members/PvcCardPrintView';
import {
  CreditCard, Search, Printer, ChevronLeft,
  RefreshCw, X, Check, Eye, Plus,
  Link2, Copy, Trash2
} from 'lucide-react';

const VERIFY_BASE_URL = 'https://kmlwj.com/member/verify';

function getMemberQrUrl(member) {
  const key = member?.memberNo || member?.id || null;
  return key ? `${VERIFY_BASE_URL}/${key}` : null;
}

const PRINT_STYLES = `
@media print {
  @page { margin: 0; size: auto; }
  /* Force full-color print for every element on the page — kills the
     browser default that strips background colors/images during printing. */
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body * { visibility: hidden !important; }
  #print-area, #print-area * {
    visibility: visible !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  #print-area img, #print-area svg { filter: none !important; }
  #print-area { position: fixed; left: 0; top: 0; width: 100%; height: 100%; background: white !important; }
}
`;

function injectPrintStyles() {
  if (document.getElementById('zk-print-styles')) return;
  const style = document.createElement('style');
  style.id = 'zk-print-styles';
  style.textContent = PRINT_STYLES;
  document.head.appendChild(style);
}

const CARD_W_MM = 85.6;
const CARD_H_MM = 53.98;

function SingleCardPrintArea({ card, areaRef }) {
  return (
    <div id="print-area" ref={areaRef} style={{
      position: 'fixed', left: '-9999px', top: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '4mm',
      width: '100mm', padding: '4mm',
      fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
    }}>
      <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column' }}>
        <ZakatCardFront card={card} />
      </div>
      <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column' }}>
        <ZakatCardBack card={card} />
      </div>
    </div>
  );
}

function IssueModal({ beneficiaries, beneficiariesLoading, onClose, onSubmit }) {
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [zakatAmount, setZakatAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [bankAccountId, setBankAccountId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = beneficiaries.filter(b => {
    if (!search) return true;
    const term = search.toLowerCase();
    return b.name?.toLowerCase().includes(term) ||
      b.cnic?.toLowerCase().includes(term) ||
      b.mobile?.toLowerCase().includes(term);
  });

  const selected = beneficiaries.find(b => b.id === beneficiaryId);

  const selectBeneficiary = (b) => {
    setBeneficiaryId(b.id);
    setSearch(b.name);
    // Auto-fill last recorded zakat amount
    if (b.lastZakatAmount) setZakatAmount(String(b.lastZakatAmount));
  };

  const handleSubmit = async () => {
    if (!beneficiaryId || !zakatAmount) return;
    setSubmitting(true);
    try {
      await onSubmit({ beneficiaryId, zakatAmount, paymentMethod, bankAccountId: bankAccountId || undefined, issueDate });
      onClose();
    } catch (err) {
      alert(err?.response?.data?.error?.message || err.message || 'Failed to issue card');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtAmt = (v) => v ? `Rs ${Number(v).toLocaleString('en-PK')}` : '—';
  const fmtDt = (v) => v ? new Date(v).toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#111', borderRadius: '16px',
        border: '1px solid #333', padding: '28px',
        maxWidth: '500px', width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Issue New Zakat Card</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Select a Zakat beneficiary from Donation Given</div>
          </div>
          <button onClick={onClose} style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Beneficiary search & select */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
            Select Beneficiary * <span style={{ color: '#64748b', fontWeight: 500 }}>(approved Zakat recipients from Donation Given)</span>
          </label>
          {beneficiariesLoading ? (
            <div style={{
              padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: '#0a0f1a', borderRadius: '8px', border: '1px solid #1e293b',
              color: '#64748b', fontSize: '12px',
            }}>
              <RefreshCw size={14} className="animate-spin" />
              Loading eligible beneficiaries...
            </div>
          ) : beneficiaries.length === 0 ? (
            <div style={{
              padding: '20px 16px', textAlign: 'center',
              background: 'rgba(127,29,29,0.1)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600, lineHeight: 1.5 }}>
                No beneficiaries with approved Zakat distributions found.
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                Record and approve a Zakat distribution in the Donation Given module first.
              </div>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); if (selected && e.target.value !== selected.name) setBeneficiaryId(''); }}
                placeholder="Search by name, CNIC, mobile..."
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  background: '#0f172a', border: '1px solid #334155',
                  color: '#e2e8f0', fontSize: '13px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {(!beneficiaryId || search !== selected?.name) && (
                <div style={{
                  maxHeight: '180px', overflowY: 'auto', marginTop: '6px',
                  background: '#0a0f1a', borderRadius: '8px', border: '1px solid #1e293b',
                }}>
                  {filtered.slice(0, 50).map(b => (
                    <div
                      key={b.id}
                      onClick={() => selectBeneficiary(b)}
                      style={{
                        padding: '10px 12px', cursor: 'pointer',
                        background: beneficiaryId === b.id ? 'rgba(13,78,43,0.3)' : 'transparent',
                        borderBottom: '1px solid #1e293b',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{b.name}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {b.cnic && <span>CNIC: {b.cnic}</span>}
                        {b.mobile && <span>Mobile: {b.mobile}</span>}
                        <span style={{ color: '#4ade80' }}>Last: {fmtAmt(b.lastZakatAmount)} on {fmtDt(b.lastZakatDate)}</span>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <div style={{ padding: '12px', color: '#475569', fontSize: '12px', textAlign: 'center' }}>No beneficiaries found</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Selected beneficiary summary */}
        {selected && (
          <div style={{
            padding: '12px 14px', borderRadius: '10px', marginBottom: '16px',
            background: 'rgba(13,78,43,0.12)', border: '1px solid rgba(74,222,128,0.15)',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80' }}>{selected.name}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {selected.cnic && <span>CNIC: {selected.cnic}</span>}
              {selected.mobile && <span>Mobile: {selected.mobile}</span>}
              {selected.address && <span>Address: {selected.address}</span>}
              <span style={{ color: '#64748b', marginTop: '2px' }}>
                Last Zakat: {fmtAmt(selected.lastZakatAmount)} · {fmtDt(selected.lastZakatDate)}
              </span>
            </div>
          </div>
        )}

        {/* Zakat Amount */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
            Zakat Amount (Rs) *
          </label>
          <input
            type="number"
            value={zakatAmount}
            onChange={e => setZakatAmount(e.target.value)}
            placeholder="Enter amount..."
            min="1"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              background: '#0f172a', border: '1px solid #334155',
              color: '#e2e8f0', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Payment Method */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              background: '#0f172a', border: '1px solid #334155',
              color: '#e2e8f0', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box',
            }}
          >
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>

        {/* Issue Date */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
            Issue Date
          </label>
          <input
            type="date"
            value={issueDate}
            onChange={e => setIssueDate(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              background: '#0f172a', border: '1px solid #334155',
              color: '#e2e8f0', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            background: '#1e293b', border: '1px solid #334155',
            color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!beneficiaryId || !zakatAmount || submitting}
            style={{
              flex: 2, padding: '10px', borderRadius: '10px',
              background: (!beneficiaryId || !zakatAmount || submitting) ? '#1e293b' : 'linear-gradient(135deg, #0D4E2B, #1A6B3C)',
              border: '1px solid',
              borderColor: (!beneficiaryId || !zakatAmount || submitting) ? '#334155' : 'rgba(201,162,39,0.5)',
              color: (!beneficiaryId || !zakatAmount || submitting) ? '#475569' : '#C9A227',
              cursor: (!beneficiaryId || !zakatAmount || submitting) ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {submitting ? 'Issuing...' : 'Issue Zakat Card'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ card, onClose, onPrint, onPrintPvc, onCopyQr }) {
  const qrUrl = getMemberQrUrl(card?.member);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#111', borderRadius: '16px',
        border: '1px solid #333', padding: '28px',
        maxWidth: '480px', width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Zakat Card Preview</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {card?.member?.fullName} • {card?.cardNumber}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: '#64748b', alignSelf: 'flex-start', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Front</div>
          <div style={{ width: '320px', height: '202px', display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            <ZakatCardFront card={card} />
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', alignSelf: 'flex-start', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '6px' }}>Back</div>
          <div style={{ width: '320px', height: '202px', display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            <ZakatCardBack card={card} />
          </div>
        </div>

        {qrUrl && (
          <div style={{
            marginTop: '16px', padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(13,78,43,0.12)', border: '1px solid rgba(74,222,128,0.15)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Link2 size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
            <span style={{
              fontSize: '11px', color: '#4ade80', fontFamily: 'monospace',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{qrUrl}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            background: '#1e293b', border: '1px solid #334155',
            color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            minWidth: '70px',
          }}>
            Close
          </button>
          {onCopyQr && (
            <button onClick={() => { onCopyQr(card); onClose(); }} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)',
              color: '#4ade80', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              minWidth: '120px',
            }}>
              <Copy size={14} />
              Copy QR Link
            </button>
          )}
          <button onClick={() => onPrint(card)} style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)',
            border: '1px solid #C9A22788',
            color: '#C9A227', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            minWidth: '100px',
          }}>
            <Printer size={15} />
            Print Card
          </button>
          {onPrintPvc && (
            <button onClick={() => onPrintPvc(card)} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #4A2C11, #6B3E1F)',
              border: '1px solid rgba(201,162,39,0.55)',
              color: '#f7d97a', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              minWidth: '120px',
              boxShadow: '0 6px 18px rgba(74,44,17,0.35)',
            }}>
              <Printer size={15} />
              Print PVC Card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const ZakatCards = () => {
  const { cards, fetchCards, issueCard, deleteCard, loading } = useZakatCardStore();
  const user = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewCard, setPreviewCard] = useState(null);
  const [pvcPrintCard, setPvcPrintCard] = useState(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [eligibleBeneficiaries, setEligibleBeneficiaries] = useState([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [printMode, setPrintMode] = useState(null);
  const [printCard, setPrintCard] = useState(null);
  const [toast, setToast] = useState(null);
  const singlePrintRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const copyQrLink = useCallback((card) => {
    const url = getMemberQrUrl(card?.member);
    if (!url) { showToast('No membership number assigned', 'error'); return; }
    navigator.clipboard.writeText(url)
      .then(() => showToast(`QR link copied for ${card.member?.fullName}`))
      .catch(() => showToast('Failed to copy', 'error'));
  }, [showToast]);

  useEffect(() => {
    injectPrintStyles();
    fetchCards();
  }, [fetchCards]);

  const openIssueModal = useCallback(() => {
    setShowIssueModal(true);
    setEligibleLoading(true);
    zakatCardService.getEligibleMembers()
      .then(res => setEligibleBeneficiaries(res.data || []))
      .catch(() => setEligibleBeneficiaries([]))
      .finally(() => setEligibleLoading(false));
  }, []);

  const filtered = cards.filter(c => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const displayName = c.beneficiary?.name || c.member?.fullName || '';
    return displayName.toLowerCase().includes(term) ||
      c.cardNumber?.toLowerCase().includes(term) ||
      c.beneficiary?.cnic?.toLowerCase().includes(term) ||
      c.member?.memberNo?.toLowerCase().includes(term);
  });

  const triggerPrint = useCallback(() => {
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(null), 500);
    }, 200);
  }, []);

  const printSingle = useCallback((card) => {
    setPreviewCard(null);
    setPrintCard(card);
    setPrintMode('single');
    setTimeout(() => {
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintMode(null), 500);
      }, 200);
    }, 300);
  }, []);

  const handleIssue = async (data) => {
    await issueCard(data);
    showToast('Zakat card issued successfully');
  };

  const handleDelete = async (card) => {
    if (!confirm(`Delete zakat card ${card.cardNumber} for ${card.member?.fullName}? This will also reverse the accounting entry.`)) return;
    try {
      await deleteCard(card.id);
      showToast('Zakat card deleted');
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const fmtAmount = (val) => {
    if (!val && val !== 0) return '—';
    return Number(val).toLocaleString('en-PK');
  };

  const fmtDate = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }`}</style>

      {toast && (
        <div style={{
          position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 99999, padding: '10px 22px', borderRadius: '12px',
          background: toast.type === 'error' ? 'rgba(127,29,29,0.97)' : 'rgba(13,78,43,0.97)',
          border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(74,222,128,0.4)'}`,
          color: '#fff', fontSize: '13px', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeUp 0.25s ease',
          whiteSpace: 'nowrap',
        }}>
          {toast.type === 'error'
            ? <X size={14} style={{ color: '#f87171' }} />
            : <Check size={14} style={{ color: '#4ade80' }} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div style={{
            padding: '10px', borderRadius: '12px',
            background: 'rgba(13,78,43,0.15)', border: '1px solid rgba(13,78,43,0.4)',
          }}>
            <CreditCard size={22} color="#4ade80" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">Zakat Cards</h1>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#C9A227',
                background: 'rgba(201,162,39,0.1)', padding: '2px 10px',
                borderRadius: '999px', border: '1px solid rgba(201,162,39,0.25)',
              }}>
                {cards.length} Issued
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Issue, preview and print Zakat disbursement cards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchCards()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold hover:border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={openIssueModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-95 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)', border: '1px solid rgba(201,162,39,0.4)', color: '#C9A227' }}
          >
            <Plus size={14} />
            Issue New Zakat Card
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by name, card number, member no..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-green-700/50 transition-colors"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Cards', value: cards.length, color: '#C9A227' },
          { label: 'Total Disbursed', value: `Rs ${fmtAmount(cards.reduce((s, c) => s + (c.zakatAmount || 0), 0))}`, color: '#4ade80' },
          { label: 'This Month', value: cards.filter(c => { const d = new Date(c.issueDate); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length, color: '#60a5fa' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#0f0f0f', border: '1px solid #1e293b',
            borderRadius: '12px', padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: '2px',
          }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Card list */}
      {loading ? (
        <div className="py-24 flex items-center justify-center">
          <RefreshCw size={32} className="animate-spin text-slate-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#0f0f0f', border: '1px solid #1e293b',
          borderRadius: '16px', padding: '60px 20px', textAlign: 'center',
        }}>
          <CreditCard size={40} color="#334155" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#475569', fontSize: '15px', fontWeight: 600 }}>
            {searchTerm ? 'No zakat cards match your search' : 'No zakat cards issued yet'}
          </div>
          <div style={{ color: '#334155', fontSize: '12px', marginTop: '6px' }}>
            {searchTerm ? 'Try a different search term' : 'Issue your first zakat card to get started'}
          </div>
          {!searchTerm && (
            <button
              onClick={openIssueModal}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                marginTop: '16px', padding: '9px 20px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)',
                border: '1px solid rgba(201,162,39,0.4)',
                color: '#C9A227', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              Issue Zakat Card
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: '#0f0f0f', border: '1px solid #1e293b', borderRadius: '14px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '120px 1fr 120px 120px 100px 180px',
            padding: '10px 16px', borderBottom: '1px solid #1e293b',
            background: '#080808',
          }}>
            {['Card No', 'Member', 'Amount', 'Issue Date', 'Payment', 'Actions'].map((h) => (
              <span key={h} style={{ fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>
          {filtered.map((card, idx) => (
            <div key={card.id} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 120px 120px 100px 180px',
              padding: '10px 16px', borderBottom: idx < filtered.length - 1 ? '1px solid #1e293b' : 'none',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '12px', color: '#C9A227', fontWeight: 600 }}>{card.cardNumber}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                  {card.beneficiary?.name || card.member?.fullName}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {card.beneficiary
                    ? [card.beneficiary.cnic && `CNIC: ${card.beneficiary.cnic}`, card.beneficiary.mobile].filter(Boolean).join(' • ')
                    : [card.member?.fatherName && `s/o ${card.member.fatherName}`, card.member?.area].filter(Boolean).join(' • ')
                  }
                </div>
              </div>
              <span style={{ fontSize: '13px', color: '#4ade80', fontWeight: 700 }}>Rs {fmtAmount(card.zakatAmount)}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{fmtDate(card.issueDate)}</span>
              <span style={{
                fontSize: '10px', fontWeight: 600,
                color: card.paymentMethod === 'CASH' ? '#4ade80' : '#60a5fa',
              }}>{card.paymentMethod}</span>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => setPreviewCard(card)}
                  style={{
                    padding: '5px 8px', borderRadius: '7px', cursor: 'pointer',
                    background: '#1e293b', border: '1px solid #334155',
                    color: '#94a3b8', fontSize: '11px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <Eye size={11} />
                  View
                </button>
                <button
                  onClick={() => printSingle(card)}
                  style={{
                    padding: '5px 8px', borderRadius: '7px', cursor: 'pointer',
                    background: 'rgba(13,78,43,0.25)', border: '1px solid rgba(201,162,39,0.3)',
                    color: '#C9A227', fontSize: '11px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <Printer size={11} />
                  Print
                </button>
                <button
                  onClick={() => copyQrLink(card)}
                  title="Copy QR verification link"
                  style={{
                    padding: '5px 8px', borderRadius: '7px', cursor: 'pointer',
                    background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)',
                    color: '#4ade80', fontSize: '11px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <Link2 size={11} />
                </button>
                <button
                  onClick={() => handleDelete(card)}
                  title="Delete this zakat card"
                  style={{
                    padding: '5px 8px', borderRadius: '7px', cursor: 'pointer',
                    background: 'rgba(127,29,29,0.15)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171', fontSize: '11px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewCard && (
        <PreviewModal
          card={previewCard}
          onClose={() => setPreviewCard(null)}
          onPrint={printSingle}
          onCopyQr={copyQrLink}
        />
      )}

      {/* Issue Modal */}
      {showIssueModal && (
        <IssueModal
          beneficiaries={eligibleBeneficiaries}
          beneficiariesLoading={eligibleLoading}
          onClose={() => setShowIssueModal(false)}
          onSubmit={handleIssue}
        />
      )}

      {/* Hidden print area */}
      {printMode === 'single' && printCard && (
        <SingleCardPrintArea card={printCard} areaRef={singlePrintRef} />
      )}
    </div>
  );
};
