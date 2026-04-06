import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SummaryCard from '../components/dashboard/SummaryCard';
import { useOrders } from '../hooks/useOrders';
import { useOrderStatus } from '../hooks/useOrderStatus';
import { fetchBuyerReport, fetchSellerReport, PartyReport } from '../api/parties';
import styles from './Dashboard.module.css';

function Dashboard() {
  const navigate = useNavigate();
  const { role, externalId } = useAuth();
  const { orders, loading, error } = useOrders();
  const { getStatus } = useOrderStatus();

  const [report, setReport]         = useState<PartyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Fetch role-specific report when externalId is set
  useEffect(() => {
    if (!externalId) return;
    setReportLoading(true);
    const fetcher = role === 'seller' ? fetchSellerReport : fetchBuyerReport;
    fetcher(externalId)
      .then((r) => setReport(r))
      .catch(() => { /* non-fatal — report is supplemental */ })
      .finally(() => setReportLoading(false));
  }, [externalId, role]);

  const totalOrders        = orders.length;
  const recurringTemplates = orders.filter((o) => o.is_recurring).length;

  // Use report data when available, else fall back to local counts
  const totalValue = report
    ? `${Object.keys(report.currencies)[0] ?? ''} ${report.total_value.toFixed(2)}`
    : '—';

  const pendingCount = orders.filter((o) => !o.is_recurring && getStatus(o.id) === 'pending').length;
  const shippedCount = orders.filter((o) => !o.is_recurring && getStatus(o.id) === 'shipped').length;

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime())
    .slice(0, 5);

  const isSeller = role === 'seller';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          {isSeller
            ? 'Seller overview — track the orders coming in from your buyers'
            : 'Purchase order management for your business'}
        </p>
      </div>

      {/* Profile prompt if no role set */}
      {!role && (
        <div style={{ background: '#fff8f0', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: '#9a3412', fontSize: '0.875rem', margin: 0 }}>
            Complete your profile to unlock buyer/seller features.
          </p>
          <button className={styles.btn} style={{ background: '#ea580c', flexShrink: 0 }} onClick={() => navigate('/settings')}>
            Set up profile
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section className={styles.section}>
        <div className={styles.summaryGrid}>
          <SummaryCard
            label={isSeller ? 'Orders Received' : 'Total Orders'}
            value={reportLoading ? '…' : (report?.order_count ?? (loading ? '…' : totalOrders))}
          />
          <SummaryCard
            label={isSeller ? 'Total Revenue' : 'Total Spend'}
            value={reportLoading ? '…' : totalValue}
          />
          <SummaryCard
            label="Pending Orders"
            value={loading ? '…' : pendingCount}
          />
          {isSeller ? (
            <SummaryCard label="Orders Shipped" value={loading ? '…' : shippedCount} />
          ) : (
            <SummaryCard label="Recurring Templates" value={loading ? '…' : recurringTemplates} />
          )}
        </div>
      </section>

      {/* Recent orders table */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {isSeller ? 'Recent Received Orders' : 'Recent Orders'}
        </h2>
        {error && <p className={styles.error}>Could not load orders: {error}</p>}
        {!error && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Currency</th>
                <th>Issue Date</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className={styles.loadingCell}>Loading orders…</td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.loadingCell}>No orders found.</td>
                </tr>
              ) : (
                recentOrders.map((order) => {
                  const status = getStatus(order.id);
                  return (
                    <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders/${order.id}`)}>
                      <td className={styles.mono}>{order.id.slice(0, 16)}…</td>
                      <td>{order.currency}</td>
                      <td>{order.issue_date}</td>
                      <td>
                        <span className={order.is_recurring ? styles.statusProcessing : styles.statusCompleted}>
                          {order.is_recurring ? 'Recurring' : 'One-off'}
                        </span>
                      </td>
                      <td>
                        {!order.is_recurring && (
                          <span className={
                            status === 'delivered' ? styles.statusCompleted :
                            status === 'shipped'   ? styles.statusProcessing :
                            styles.statusPending
                          }>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </section>

      {/* Quick Actions — buyers only */}
      {!isSeller && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.actionsRow}>
            <button className={styles.btn} onClick={() => navigate('/orders/new')}>
              Create Order
            </button>
            <button className={styles.btn} onClick={() => navigate('/templates/new')}>
              New Template
            </button>
          </div>
        </section>
      )}

      {/* Seller quick actions */}
      {isSeller && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.actionsRow}>
            <button className={styles.btn} onClick={() => navigate('/received-orders')}>
              View All Received Orders
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
