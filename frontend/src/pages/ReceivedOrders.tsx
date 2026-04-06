import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchSellerOrders, PartyOrder } from '../api/parties';
import { useOrderStatus, OrderStatus } from '../hooks/useOrderStatus';
import s from '../styles/shared.module.css';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Pending',
  shipped:   'Shipped',
  delivered: 'Delivered',
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending:   s.badgeYellow,
  shipped:   s.badgeBlue,
  delivered: s.badgeGreen,
};

export default function ReceivedOrders() {
  const { externalId, role } = useAuth();
  const navigate = useNavigate();
  const { getStatus, updateStatus } = useOrderStatus();

  const [orders, setOrders]   = useState<PartyOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Filter tab state
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');

  useEffect(() => {
    if (!externalId || role !== 'seller') return;
    setLoading(true);
    setError(null);
    fetchSellerOrders(externalId)
      .then((session) => {
        if (!session) {
          // 404 just means no orders yet
          setOrders([]);
        } else {
          setOrders(session.orders);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, [externalId, role]);

  // If user is not a seller, show a helpful message
  if (role !== 'seller') {
    return (
      <div className={s.page}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>Received Orders</h1>
        </div>
        <div className={s.card}>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            This page is for sellers. Your account is set up as a <strong>buyer</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (!externalId) {
    return (
      <div className={s.page}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>Received Orders</h1>
        </div>
        <div className={s.card}>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            No seller ID configured. Please update your profile in{' '}
            <button className={s.backLink} onClick={() => navigate('/settings')}>Settings</button>.
          </p>
        </div>
      </div>
    );
  }

  const visibleOrders =
    filter === 'all'
      ? orders
      : orders.filter((o) => getStatus(o.order_id) === filter);

  const pendingCount   = orders.filter((o) => getStatus(o.order_id) === 'pending').length;
  const shippedCount   = orders.filter((o) => getStatus(o.order_id) === 'shipped').length;
  const deliveredCount = orders.filter((o) => getStatus(o.order_id) === 'delivered').length;

  function handleAdvanceStatus(orderId: string) {
    const current = getStatus(orderId);
    if (current === 'pending')  updateStatus(orderId, 'shipped');
    if (current === 'shipped')  updateStatus(orderId, 'delivered');
    // 'delivered' is terminal — no further transitions
  }

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Received Orders</h1>
          <p className={s.pageSubtitle}>
            Orders placed with your seller ID:{' '}
            <span className={s.mono} style={{ color: '#4361ee', fontWeight: 700 }}>{externalId}</span>
          </p>
        </div>
      </div>

      {/* Status summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className={s.card} style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Pending</p>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{pendingCount}</p>
        </div>
        <div className={s.card} style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Shipped</p>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{shippedCount}</p>
        </div>
        <div className={s.card} style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Delivered</p>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{deliveredCount}</p>
        </div>
      </div>

      <div className={s.card}>
        {/* Filter tabs */}
        <div className={s.tabs} style={{ marginBottom: 20 }}>
          {(['all', 'pending', 'shipped', 'delivered'] as const).map((f) => (
            <button
              key={f}
              className={`${s.tab} ${filter === f ? s.tabActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : STATUS_LABELS[f as OrderStatus]}
            </button>
          ))}
        </div>

        {error && <p className={s.error}>{error}</p>}

        {loading ? (
          <p className={s.loadingCell}>Loading orders…</p>
        ) : visibleOrders.length === 0 ? (
          <p className={s.emptyCell}>
            {orders.length === 0
              ? 'No orders received yet. Share your seller ID with buyers so they can place orders.'
              : 'No orders in this category.'}
          </p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Currency</th>
                <th>Lines</th>
                <th>Value</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const status = getStatus(order.order_id);
                const total  = order.order_lines.reduce(
                  (sum, l) => sum + l.quantity * l.unit_price,
                  0,
                );
                return (
                  <tr
                    key={order.order_id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/orders/${order.order_id}`)}
                  >
                    <td className={s.mono} style={{ fontSize: '0.8rem' }}>
                      {order.order_id.slice(0, 16)}…
                    </td>
                    <td>{order.issue_date}</td>
                    <td>{order.currency}</td>
                    <td style={{ textAlign: 'center' }}>{order.order_lines.length}</td>
                    <td style={{ fontWeight: 600 }}>
                      {order.currency} {total.toFixed(2)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <span className={`${s.badge} ${STATUS_BADGE[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {status === 'pending' && (
                        <button
                          className={s.btnPrimary}
                          style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                          onClick={() => handleAdvanceStatus(order.order_id)}
                        >
                          Mark Shipped
                        </button>
                      )}
                      {status === 'shipped' && (
                        <button
                          className={s.btnSecondary}
                          style={{ padding: '4px 12px', fontSize: '0.78rem', color: '#15803d', borderColor: '#bbf7d0' }}
                          onClick={() => handleAdvanceStatus(order.order_id)}
                        >
                          Mark Delivered
                        </button>
                      )}
                      {status === 'delivered' && (
                        <span style={{ fontSize: '0.78rem', color: '#15803d' }}>✓ Complete</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
