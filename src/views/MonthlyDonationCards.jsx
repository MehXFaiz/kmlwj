import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMonthlyDonationCardStore } from '../store/monthlyDonationCardStore';
import { useAuthStore } from '../store/authStore';
import { useConfirmStore } from '../store/confirmStore';
import { showToast } from '../components/ui/Toast';
import { MonthlyDonationCardFront, MonthlyDonationCardBack } from '../components/members/MonthlyDonationCard';
import { PvcCardPrintView } from '../components/members/PvcCardPrintView';
import {
  CreditCard, Search, Printer, RefreshCw, X, Check, Eye, Plus,
  Link2, Copy, Trash2, Calendar, Users, Heart
} from 'lucide-react';

const VERIFY_BASE_URL = 'https://kmlwj.com/verify/monthly-donation';

function getMonthlyCardQrUrl(card) {
  const key = card?.cardNumber || card?.id || null;
  return key ? `${VERIFY_BASE_URL}/${encodeURIComponent(key)}` : null;
}

const PRINT_STYLES = `
@media print {
  @page { margin: 0; size: A4 portrait; }
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body * { visibility: hidden !important; }
  #print-area, #print-area *,
  #pvc-print-sheet, #pvc-print-sheet *,
  #pvc-print-portal, #pvc-print-portal * {
    visibility: visible !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  #print-area img, #print-area svg,
  #pvc-print-sheet img, #pvc-print-sheet svg { filter: none !important; opacity: 1 !important; }
  #print-area, #pvc-print-sheet {
    position: absolute !important; left: 0 !important; top: 0 !important;
    width: 210mm !important; background: #ffffff !important; margin: 0 !important;
  }
}
`;

function injectPrintStyles() {
  if (document.getElementById('md-print-styles')) return;
  const style = document.createElement('style');
  style.id = 'md-print-styles';
  style.textContent = PRINT_STYLES;
  document.head.appendChild(style);
}

const CARD_W_MM = 85.6;
const CARD_H_MM = 53.98;

function SingleCardPrintArea({ card, areaRef }) {
  return (
    <div id="print-area" ref={areaRef} style={{
      position: 'fixed', left: '-9999px', top: 0,
      display: 'flex', flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: '6mm',
      width: '210mm', padding: '10mm',
      fontFamily: "'Noto Nastaliq Urdu', 'Plus Jakarta Sans', Inter, sans-serif",
    }}>
      {/* Front Side (Left) */}
      <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column' }}>
        <MonthlyDonationCardFront card={card} />
      </div>
      {/* Back Side (Right) */}
      <div style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm`, display: 'flex', flexDirection: 'column' }}>
        <MonthlyDonationCardBack card={card} />
      </div>
    </div>
  );
}

function IssueModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [cnic, setCnic] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('Lyari, Karachi');
  const [gham, setGham] = useState('LOHARWADA');
  const [amount, setAmount] = useState('5000');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !amount) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        fatherName,
        cnic,
        mobile,
        address,
        gham,
        amount: Number(amount),
        monthlyAmount: Number(amount),
        issueDate,
        photoUrl: photoUrl.trim() || undefined,
      });
      onClose();
    } catch (err) {
      alert(err?.message || 'Failed to issue card');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#111', borderRadius: '16px',
        border: '1px solid #333', padding: '24px',
        maxWidth: '520px', width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
              Issue Monthly Financial Support Card (ماہانہ مالی امداد کارڈ)
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Create a personalized bilingual Urdu / English PVC financial support card
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Full Name */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '5px', display: 'block' }}>
            Recipient / Donor Name (نام) *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. MOHAMMAD IMRAN"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              background: '#0f172a', border: '1px solid #334155',
              color: '#e2e8f0', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Father / Husband Name */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '5px', display: 'block' }}>
            Father / Husband Name (ولدیت / شوہر کا نام)
          </label>
          <input
            type="text"
            value={fatherName}
            onChange={e => setFatherName(e.target.value)}
            placeholder="e.g. ABDUL REHMAN"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              background: '#0f172a', border: '1px solid #334155',
              color: '#e2e8f0', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          {/* CNIC */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '5px', display: 'block' }}>
              CNIC (شناختی کارڈ)
            </label>
            <input
              type="text"
              value={cnic}
              onChange={e => setCnic(e.target.value)}
              placeholder="42301-XXXXXXX-X"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: '#0f172a', border: '1px solid #334155',
                color: '#e2e8f0', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Mobile */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '5px', display: 'block' }}>
              Mobile (فون نمبر)
            </label>
            <input
              type="text"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              placeholder="0300-XXXXXXX"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: '#0f172a', border: '1px solid #334155',
                color: '#e2e8f0', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          {/* Monthly Amount */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '5px', display: 'block' }}>
              Monthly Amount (ماہانہ رقم) *
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="5000"
              min="1"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                background: '#0f172a', border: '1px solid #334155',
                color: '#e2e8f0', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Issue Date */}
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '5px', display: 'block' }}>
              Issue Date (تاریخ اجراء)
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
        </div>

        {/* Address */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '5px', display: 'block' }}>
            Address (رہائشی پتہ)
          </label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="e.g. Lyari, Karachi"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '10px',
              background: '#0f172a', border: '1px solid #334155',
              color: '#e2e8f0', fontSize: '13px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Photo URL */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginBottom: '5px', display: 'block' }}>
            Photo Image URL (اختیاری تصویر کا لنک)
          </label>
          <input
            type="text"
            value={photoUrl}
            onChange={e => setPhotoUrl(e.target.value)}
            placeholder="https://... or data:image/..."
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
            disabled={!name || !amount || submitting}
            style={{
              flex: 2, padding: '10px', borderRadius: '10px',
              background: (!name || !amount || submitting) ? '#1e293b' : 'linear-gradient(135deg, #0D4E2B, #1A6B3C)',
              border: '1px solid',
              borderColor: (!name || !amount || submitting) ? '#334155' : 'rgba(212,175,55,0.5)',
              color: (!name || !amount || submitting) ? '#475569' : '#F5D77F',
              cursor: (!name || !amount || submitting) ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {submitting ? 'Issuing...' : 'Issue Monthly Card'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ card, onClose, onPrint, onPrintPvc, onCopyQr }) {
  const qrUrl = getMonthlyCardQrUrl(card);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#111', borderRadius: '16px',
        border: '1px solid #333', padding: '24px',
        maxWidth: '720px', width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
              Monthly Financial Support Card Preview (ماہانہ مالی امداد کارڈ)
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              {card?.name} • {card?.cardNumber}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Front Side (سامنے کا رخ)</div>
            <div style={{ width: '320px', height: '202px', display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              <MonthlyDonationCardFront card={card} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Back Side (پچھلا رخ)</div>
            <div style={{ width: '320px', height: '202px', display: 'flex', flexDirection: 'column', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              <MonthlyDonationCardBack card={card} />
            </div>
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
            border: '1px solid rgba(212,175,55,0.5)',
            color: '#F5D77F', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            minWidth: '100px',
          }}>
            <Printer size={15} />
            Print Card
          </button>
          {onPrintPvc && (
            <button onClick={() => onPrintPvc(card)} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #0D4E2B, #08381E)',
              border: '1px solid rgba(212,175,55,0.55)',
              color: '#f7d97a', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              minWidth: '120px',
              boxShadow: '0 6px 18px rgba(13,78,43,0.35)',
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

export const MonthlyDonationCards = () => {
  const { cards, fetchCards, issueCard, deleteCard, loading } = useMonthlyDonationCardStore();
  const canEditOrDelete = useAuthStore((state) => state.canEditOrDelete);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewCard, setPreviewCard] = useState(null);
  const [pvcPrintCard, setPvcPrintCard] = useState(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [printMode, setPrintMode] = useState(null);
  const [printCard, setPrintCard] = useState(null);
  const singlePrintRef = useRef(null);

  const copyQrLink = useCallback((card) => {
    const url = getMonthlyCardQrUrl(card);
    if (!url) { showToast('No card number assigned', 'error'); return; }
    navigator.clipboard.writeText(url)
      .then(() => showToast(`QR link copied for ${card.name}`))
      .catch(() => showToast('Failed to copy', 'error'));
  }, []);

  useEffect(() => {
    injectPrintStyles();
    fetchCards();
  }, [fetchCards]);

  const filtered = cards.filter(c => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const name = c.name || '';
    const fName = c.fatherName || '';
    return name.toLowerCase().includes(term) ||
      fName.toLowerCase().includes(term) ||
      c.cardNumber?.toLowerCase().includes(term) ||
      c.cnic?.toLowerCase().includes(term) ||
      c.mobile?.toLowerCase().includes(term);
  });

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
    showToast('Monthly donation card issued successfully');
  };

  const handleDelete = async (card) => {
    const name = card.name || 'Unknown';
    const cardNo = card.cardNumber || 'N/A';

    const confirmed = await useConfirmStore.getState().showConfirm({
      type: 'danger',
      isDangerous: true,
      title: 'Delete Monthly Donation Card?',
      description: `Are you sure you want to delete Monthly Donation Card ${cardNo} for ${name}?`,
      details: [
        'Delete the monthly card record.',
        'Remove QR verification identifier.',
      ],
      confirmLabel: 'Delete Card',
      cancelLabel: 'Cancel',
      loadingLabel: 'Deleting...',
      successMessage: 'Monthly Donation Card deleted successfully.',
      action: async () => {
        await deleteCard(card.id);
      },
    });

    if (confirmed) {
      showToast('Monthly Donation Card deleted successfully.');
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div style={{
            padding: '10px', borderRadius: '12px',
            background: 'rgba(13,78,43,0.15)', border: '1px solid rgba(13,78,43,0.4)',
          }}>
            <Heart size={22} color="#4ade80" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">Monthly Financial Support Cards</h1>
              <span style={{
                fontSize: '11px', fontWeight: 700, color: '#D4AF37',
                fontFamily: "'Noto Nastaliq Urdu', sans-serif",
              }}>
                (ماہانہ مالی امداد کارڈز)
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#C9A227',
                background: 'rgba(201,162,39,0.1)', padding: '2px 10px',
                borderRadius: '999px', border: '1px solid rgba(201,162,39,0.25)',
              }}>
                {cards.length} Cards
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Issue, preview and print bilingual Urdu / English monthly financial support PVC cards
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
            onClick={() => setShowIssueModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-95 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)', border: '1px solid rgba(212,175,55,0.4)', color: '#F5D77F' }}
          >
            <Plus size={14} />
            Issue Support Card (نیا کارڈ)
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
          placeholder="Search by name, father name, card number, CNIC..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-green-700/50 transition-colors"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Cards Issued', value: cards.length, color: '#C9A227' },
          { label: 'Total Monthly Amount', value: `Rs ${fmtAmount(cards.reduce((s, c) => s + (c.amount || c.monthlyAmount || 0), 0))}`, color: '#4ade80' },
          { label: 'Active Beneficiaries', value: cards.filter(c => c.status !== 'INACTIVE').length, color: '#60a5fa' },
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
            {searchTerm ? 'No financial support cards match your search' : 'No monthly financial support cards issued yet'}
          </div>
          <div style={{ color: '#334155', fontSize: '12px', marginTop: '6px' }}>
            {searchTerm ? 'Try a different search term' : 'Issue your first financial support card to get started'}
          </div>
          {!searchTerm && (
            <button
              onClick={() => setShowIssueModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                marginTop: '16px', padding: '9px 20px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #0D4E2B, #1A6B3C)',
                border: '1px solid rgba(212,175,55,0.4)',
                color: '#F5D77F', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              Issue Financial Support Card
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: '#0f0f0f', border: '1px solid #1e293b', borderRadius: '14px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '130px 1fr 120px 120px 180px',
            padding: '10px 16px', borderBottom: '1px solid #1e293b',
            background: '#080808',
          }}>
            {['Card No', 'Recipient Name', 'Monthly Amount', 'Issue Date', 'Actions'].map((h) => (
              <span key={h} style={{ fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>
          {filtered.map((card, idx) => (
            <div key={card.id} style={{
              display: 'grid', gridTemplateColumns: '130px 1fr 120px 120px 180px',
              padding: '12px 16px', borderBottom: idx < filtered.length - 1 ? '1px solid #1e293b' : 'none',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '12px', color: '#D4AF37', fontWeight: 700, fontFamily: 'monospace' }}>
                {card.cardNumber}
              </span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                  {card.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {card.fatherName && <span>s/o {card.fatherName}</span>}
                  {card.cnic && <span>CNIC: {card.cnic}</span>}
                  {card.mobile && <span>Mob: {card.mobile}</span>}
                </div>
              </div>
              <span style={{ fontSize: '13px', color: '#4ade80', fontWeight: 700 }}>
                Rs {fmtAmount(card.amount || card.monthlyAmount)}
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {fmtDate(card.issueDate)}
              </span>
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
                    background: 'rgba(13,78,43,0.25)', border: '1px solid rgba(212,175,55,0.3)',
                    color: '#F5D77F', fontSize: '11px', fontWeight: 600,
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
                {canEditOrDelete && (
                  <button
                    onClick={() => handleDelete(card)}
                    title="Delete this monthly donation card"
                    style={{
                      padding: '5px 8px', borderRadius: '7px', cursor: 'pointer',
                      background: 'rgba(127,29,29,0.15)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171', fontSize: '11px', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Issue Modal ── */}
      {showIssueModal && (
        <IssueModal
          onClose={() => setShowIssueModal(false)}
          onSubmit={handleIssue}
        />
      )}

      {/* ── Preview Modal ── */}
      {previewCard && (
        <PreviewModal
          card={previewCard}
          onClose={() => setPreviewCard(null)}
          onPrint={printSingle}
          onPrintPvc={(c) => { setPreviewCard(null); setPvcPrintCard(c); }}
          onCopyQr={copyQrLink}
        />
      )}

      {/* ── Dedicated PVC card print view ── */}
      {pvcPrintCard && (
        <PvcCardPrintView
          isOpen={true}
          variant="monthly"
          data={pvcPrintCard}
          onClose={() => setPvcPrintCard(null)}
        />
      )}

      {/* ── Hidden print areas ── */}
      {printMode === 'single' && printCard && (
        <SingleCardPrintArea card={printCard} areaRef={singlePrintRef} />
      )}
    </div>
  );
};

export default MonthlyDonationCards;
