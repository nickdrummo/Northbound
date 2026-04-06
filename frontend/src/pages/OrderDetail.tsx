import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrder } from '../hooks/useOrder';
import { cancelOrder, updatePartyCountry } from '../api/orders';
import s from '../styles/shared.module.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ISO 3166-1 alpha-2 codes the backend validates against
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AU', name: 'Australia' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'AE', name: 'UAE' },
];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { order, loading, error } = useOrder(id!);

  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Party country edit state
  const [countryRole, setCountryRole] = useState<'buyer' | 'seller'>('buyer');
  const [countryCode, setCountryCode] = useState('AU');
  const [countrySubmitting, setCountrySubmitting] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [countrySuccess, setCountrySuccess] = useState(false);

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOrder(order.id);
      setShowConfirm(false);
      navigate('/orders');
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  }

  async function handleCountryUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setCountrySubmitting(true);
    setCountryError(null);
    setCountrySuccess(false);
    try {
      await updatePartyCountry(order.id, countryRole, countryCode);
      setCountrySuccess(true);
    } catch (err) {
      setCountryError(err instanceof Error ? err.message : 'Failed to update country');
    } finally {
      setCountrySubmitting(false);
    }
  }

  if (loading) return <div className={s.page}><p className={s.loadingCell}>Loading order…</p></div>;
  if (error || !order) return <div className={s.page}><p className={s.error}>{error ?? 'Order not found.'}</p></div>;

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <button className={s.backLink} onClick={() => navigate('/orders')}>← Back to Orders</button>
          <h1 className={s.pageTitle} style={{ marginTop: 6 }}>Order Detail</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={`${API_URL}/orders/${order.id}/xml`}
            target="_blank"
            rel="noreferrer"
            className={s.btnSecondary}
            style={{ textDecoration: 'none' }}
          >
            ↓ Download XML
          </a>
          {!order.is_recurring && (
            <button className={s.btnDanger} onClick={() => setShowConfirm(true)}>
              Cancel Order
            </button>
          )}
        </div>
      </div>

      <div className={s.card}>
        <p className={s.sectionHeading}>Order Information</p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Order ID</span>
            <span className={`${s.detailValue} ${s.mono}`}>{order.id}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Currency</span>
            <span className={s.detailValue}>{order.currency}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Issue Date</span>
            <span className={s.detailValue}>{order.issue_date}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Type</span>
            <span className={s.detailValue}>
              <span className={`${s.badge} ${order.is_recurring ? s.badgePurple : s.badgeBlue}`}>
                {order.is_recurring ? 'Recurring' : 'One-off'}
              </span>
            </span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Note</span>
            <span className={s.detailValue}>{order.order_note ?? '—'}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Created</span>
            <span className={s.detailValue}>{new Date(order.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className={s.card}>
        <p className={s.sectionHeading}>Parties</p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Buyer ID</span>
            <span className={`${s.detailValue} ${s.mono}`}>{order.buyer_id}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Seller ID</span>
            <span className={`${s.detailValue} ${s.mono}`}>{order.seller_id}</span>
          </div>
        </div>

        {/* Update party country */}
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            Update Party Country
          </p>
          <form onSubmit={handleCountryUpdate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className={s.formField} style={{ minWidth: 120 }}>
              <label>Party</label>
              <select value={countryRole} onChange={(e) => setCountryRole(e.target.value as 'buyer' | 'seller')}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
            <div className={s.formField} style={{ minWidth: 180 }}>
              <label>Country</label>
              <select value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setCountrySuccess(false); }}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <button type="submit" className={s.btnPrimary} disabled={countrySubmitting} style={{ marginBottom: 1 }}>
              {countrySubmitting ? 'Saving…' : 'Update'}
            </button>
          </form>
          {countryError  && <p className={s.error}  style={{ marginTop: 10 }}>{countryError}</p>}
          {countrySuccess && <p className={s.success} style={{ marginTop: 10 }}>Country updated successfully.</p>}
        </div>
      </div>

      {order.is_recurring && (
        <div className={s.card}>
          <p className={s.sectionHeading}>Recurrence</p>
          <div className={s.detailGrid}>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Frequency</span>
              <span className={s.detailValue}>{order.frequency ?? '—'}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Interval</span>
              <span className={s.detailValue}>{order.recur_interval ?? '—'}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Start Date</span>
              <span className={s.detailValue}>{order.recur_start_date ?? '—'}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>End Date</span>
              <span className={s.detailValue}>{order.recur_end_date ?? 'Ongoing'}</span>
            </div>
          </div>
        </div>
      )}

      {cancelError && <p className={s.error}>{cancelError}</p>}

      {showConfirm && (
        <div className={s.overlay}>
          <div className={s.dialog}>
            <p className={s.dialogTitle}>Cancel this order?</p>
            <p className={s.dialogBody}>
              This will permanently delete order <strong>{order.id}</strong>. This action cannot be undone.
            </p>
            <div className={s.dialogActions}>
              <button className={s.btnSecondary} onClick={() => setShowConfirm(false)} disabled={cancelling}>
                Keep Order
              </button>
              <button className={s.btnDanger} onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
