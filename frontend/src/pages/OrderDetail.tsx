import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrder } from '../hooks/useOrder';
import { cancelOrder } from '../api/orders';
import s from '../styles/shared.module.css';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { order, loading, error } = useOrder(id!);

  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  if (loading) return <div className={s.page}><p className={s.loadingCell}>Loading order…</p></div>;
  if (error || !order) return <div className={s.page}><p className={s.error}>{error ?? 'Order not found.'}</p></div>;

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <button className={s.backLink} onClick={() => navigate('/orders')}>← Back to Orders</button>
          <h1 className={s.pageTitle} style={{ marginTop: 6 }}>Order Detail</h1>
        </div>
        {!order.is_recurring && (
          <button className={s.btnDanger} onClick={() => setShowConfirm(true)}>
            Cancel Order
          </button>
        )}
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
        <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#a0aec0' }}>
          Full party names will be available once a Suppliers endpoint is added to the backend.
        </p>
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

      {/* Cancel confirmation dialog */}
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
