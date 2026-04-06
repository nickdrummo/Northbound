import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMyOrders } from '../hooks/useMyOrders';
import { useOrderStatus, OrderStatus } from '../hooks/useOrderStatus';
import s from '../styles/shared.module.css';

type Filter = 'all' | 'one-off' | 'recurring';

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending:   s.badgeYellow,
  shipped:   s.badgeBlue,
  delivered: s.badgeGreen,
};

export default function Orders() {
  const { orders, loading, error } = useMyOrders();
  const { role, externalId } = useAuth();
  const { getStatus } = useOrderStatus();
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();

  const filtered = orders.filter((o) => {
    if (filter === 'one-off') return !o.is_recurring;
    if (filter === 'recurring') return o.is_recurring;
    return true;
  });

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>
            {role === 'seller' ? 'Received Orders' : 'My Orders'}
          </h1>
          <p className={s.pageSubtitle}>
            {externalId
              ? `Showing orders for ${role === 'seller' ? 'seller' : 'buyer'} ID: ${externalId}`
              : 'Set up your profile in Settings to filter to your own orders'}
          </p>
        </div>
        {role !== 'seller' && (
          <button className={s.btnPrimary} onClick={() => navigate('/orders/new')}>
            + New Order
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className={s.tabs}>
        {(['all', 'one-off', 'recurring'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`${s.tab} ${filter === f ? s.tabActive : ''}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className={s.error}>Could not load orders: {error}</p>}

      <table className={s.table}>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Currency</th>
            <th>Issue Date</th>
            <th>Type</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className={s.loadingCell}>Loading orders…</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={6} className={s.emptyCell}>No orders found.</td></tr>
          ) : (
            filtered.map((order) => {
              const status = getStatus(order.id);
              return (
                <tr
                  key={order.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <td className={s.mono} style={{ fontSize: '0.8rem' }}>
                    {order.id.length > 20 ? `${order.id.slice(0, 18)}…` : order.id}
                  </td>
                  <td>{order.currency}</td>
                  <td>{order.issue_date}</td>
                  <td>
                    <span className={`${s.badge} ${order.is_recurring ? s.badgePurple : s.badgeBlue}`}>
                      {order.is_recurring ? 'Recurring' : 'One-off'}
                    </span>
                  </td>
                  <td>
                    {!order.is_recurring && (
                      <span className={`${s.badge} ${STATUS_BADGE[status]}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    )}
                  </td>
                  <td>{order.order_note ?? '—'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
