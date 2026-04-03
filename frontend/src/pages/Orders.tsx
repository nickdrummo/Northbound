import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import s from '../styles/shared.module.css';

type Filter = 'all' | 'one-off' | 'recurring';

export default function Orders() {
  const { orders, loading, error } = useOrders();
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
          <h1 className={s.pageTitle}>Orders</h1>
          <p className={s.pageSubtitle}>All purchase orders</p>
        </div>
        <button className={s.btnPrimary} onClick={() => navigate('/orders/new')}>
          + New Order
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['all', 'one-off', 'recurring'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: filter === f ? '#4361ee' : '#e2e8f0',
              background: filter === f ? '#ebf0ff' : '#fff',
              color: filter === f ? '#2d3a8c' : '#718096',
              fontWeight: filter === f ? 700 : 500,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
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
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} className={s.loadingCell}>Loading orders…</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={5} className={s.emptyCell}>No orders found.</td></tr>
          ) : (
            filtered.map((order) => (
              <tr
                key={order.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <td className={s.mono}>{order.id}</td>
                <td>{order.currency}</td>
                <td>{order.issue_date}</td>
                <td>
                  <span className={`${s.badge} ${order.is_recurring ? s.badgePurple : s.badgeBlue}`}>
                    {order.is_recurring ? 'Recurring' : 'One-off'}
                  </span>
                </td>
                <td>{order.order_note ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
