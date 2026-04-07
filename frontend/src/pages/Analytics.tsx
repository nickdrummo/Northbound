import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyOrders } from '../hooks/useMyOrders';
import { useOrderStatus, OrderStatus } from '../hooks/useOrderStatus';
import { useAuth } from '../context/AuthContext';
import s from '../styles/shared.module.css';

// ── helpers ────────────────────────────────────────────────────────────────

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'Unknown' : d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

// Simple inline bar component
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '0.78rem', color: '#64748b', minWidth: 24, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// Stat card
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={s.card} style={{ flex: '1 1 180px', minWidth: 140 }}>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#94a3b8', margin: '0 0 8px' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.8rem', fontWeight: 800, color: color ?? '#0f172a', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '6px 0 0' }}>{sub}</p>}
    </div>
  );
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:   '#f59e0b',
  shipped:   '#4361ee',
  delivered: '#10b981',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Pending',
  shipped:   'Shipped',
  delivered: 'Delivered',
};

// ── page ───────────────────────────────────────────────────────────────────

export default function Analytics() {
  const navigate  = useNavigate();
  const { role }  = useAuth();
  const { orders, loading, error } = useMyOrders();
  const { getStatus } = useOrderStatus();

  const stats = useMemo(() => {
    const total     = orders.length;
    const recurring = orders.filter((o) => o.is_recurring).length;
    const oneOff    = total - recurring;

    // Status breakdown (reads from localStorage via useOrderStatus)
    const statusCounts = countBy(orders, (o) => getStatus(o.id));

    // Currency breakdown
    const currencyCounts = countBy(orders, (o) => o.currency);

    // Frequency breakdown (recurring only)
    const freqCounts = countBy(
      orders.filter((o) => o.is_recurring && o.frequency),
      (o) => o.frequency ?? 'UNKNOWN',
    );

    // Orders by month (using issue_date or recur_start_date)
    const monthCounts = countBy(orders, (o) => monthLabel(o.issue_date ?? o.recur_start_date ?? ''));

    // Sort months chronologically (last 6)
    const sortedMonths = Object.entries(monthCounts)
      .sort(([a], [b]) => new Date('01 ' + a).getTime() - new Date('01 ' + b).getTime())
      .slice(-6);

    // Recent orders (last 5 by created_at)
    const recent = [...orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    return { total, recurring, oneOff, statusCounts, currencyCounts, freqCounts, sortedMonths, recent };
  }, [orders, getStatus]);

  if (loading) return <div className={s.page}><p className={s.loadingCell}>Loading analytics…</p></div>;
  if (error)   return <div className={s.page}><p className={s.error}>{error}</p></div>;

  const maxMonth   = Math.max(...stats.sortedMonths.map(([, v]) => v), 1);
  const maxStatus  = Math.max(...Object.values(stats.statusCounts), 1);
  const maxCurr    = Math.max(...Object.values(stats.currencyCounts), 1);

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Analytics</h1>
          <p className={s.pageSubtitle}>
            {role === 'seller' ? 'Summary of orders received' : 'Summary of your purchasing activity'}
          </p>
        </div>
      </div>

      {stats.total === 0 ? (
        <div className={s.card} style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No orders yet — analytics will appear here once you have orders.</p>
        </div>
      ) : (
        <>
          {/* ── Top stat cards ── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <StatCard label="Total Orders"    value={stats.total} />
            <StatCard label="One-off"         value={stats.oneOff}    color="#4361ee" />
            <StatCard label="Recurring"       value={stats.recurring} color="#7c3aed" />
            <StatCard label="Pending"         value={stats.statusCounts['pending']   ?? 0} color="#f59e0b" />
            <StatCard label="Shipped"         value={stats.statusCounts['shipped']   ?? 0} color="#4361ee" />
            <StatCard label="Delivered"       value={stats.statusCounts['delivered'] ?? 0} color="#10b981" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {/* ── Orders by status ── */}
            <div className={s.card}>
              <p className={s.sectionHeading}>Orders by Status</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(['pending', 'shipped', 'delivered'] as OrderStatus[]).map((status) => (
                  <div key={status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{STATUS_LABELS[status]}</span>
                    </div>
                    <Bar value={stats.statusCounts[status] ?? 0} max={maxStatus} color={STATUS_COLORS[status]} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Orders by currency ── */}
            <div className={s.card}>
              <p className={s.sectionHeading}>Orders by Currency</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(stats.currencyCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([currency, count]) => (
                    <div key={currency}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{currency}</span>
                      </div>
                      <Bar value={count} max={maxCurr} color="#4361ee" />
                    </div>
                  ))}
              </div>
            </div>

            {/* ── Recurring frequency breakdown (only shown if there are recurring orders) ── */}
            {stats.recurring > 0 && (
              <div className={s.card}>
                <p className={s.sectionHeading}>Recurring Frequency</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.entries(stats.freqCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([freq, count]) => (
                      <div key={freq}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>
                            {freq.charAt(0) + freq.slice(1).toLowerCase()}
                          </span>
                        </div>
                        <Bar value={count} max={stats.recurring} color="#7c3aed" />
                      </div>
                    ))}
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                    {stats.recurring} of {stats.total} orders are recurring
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Orders per month ── */}
          {stats.sortedMonths.length > 0 && (
            <div className={s.card}>
              <p className={s.sectionHeading}>Orders per Month</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.sortedMonths.map(([month, count]) => (
                  <div key={month}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{month}</span>
                    </div>
                    <Bar value={count} max={maxMonth} color="#4361ee" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent orders ── */}
          <div className={s.card}>
            <p className={s.sectionHeading}>Recent Orders</p>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Currency</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((order) => {
                  const status = getStatus(order.id);
                  return (
                    <tr
                      key={order.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <td className={s.mono} style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {order.id.slice(0, 8)}…
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {order.issue_date ?? order.recur_start_date ?? '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{order.currency}</td>
                      <td>
                        <span className={`${s.badge} ${order.is_recurring ? s.badgePurple : s.badgeBlue}`}
                          style={{ fontSize: '0.72rem' }}>
                          {order.is_recurring ? 'Recurring' : 'One-off'}
                        </span>
                      </td>
                      <td>
                        <span className={`${s.badge} ${
                          status === 'delivered' ? s.badgeGreen :
                          status === 'shipped'   ? s.badgeBlue  :
                          s.badgeYellow
                        }`} style={{ fontSize: '0.72rem' }}>
                          {STATUS_LABELS[status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
