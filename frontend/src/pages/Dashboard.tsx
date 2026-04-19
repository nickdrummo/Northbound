import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import SummaryCard from '../components/dashboard/SummaryCard';
import { useMyOrders } from '../hooks/useMyOrders';
import { useOrderStatus } from '../hooks/useOrderStatus';
import { useOrderNames } from '../hooks/useOrderNames';
import { fetchBuyerReport, fetchSellerReport, PartyReport } from '../api/parties';
import styles from './Dashboard.module.css';

function Dashboard() {
  const navigate = useNavigate();
  const { role, externalId } = useAuth();
  const { t } = useLanguage();
  const { orders, loading, error } = useMyOrders();
  const { getStatus } = useOrderStatus();
  const { getName: getOrderName } = useOrderNames();

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
        <h1 className={styles.title}>{t('dashboard.title')}</h1>
        <p className={styles.subtitle}>
          {isSeller ? t('dashboard.subtitle.seller') : t('dashboard.subtitle.buyer')}
        </p>
      </div>

      {/* Profile prompt if no role set */}
      {!role && (
        <div style={{ background: '#fff8f0', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: '#9a3412', fontSize: '0.875rem', margin: 0 }}>
            {t('dashboard.completeProfilePrompt')}
          </p>
          <button className={styles.btn} style={{ background: '#ea580c', flexShrink: 0 }} onClick={() => navigate('/settings')}>
            {t('dashboard.setUpProfile')}
          </button>
        </div>
      )}

      {/* Summary cards */}
      <section className={styles.section}>
        <div className={styles.summaryGrid}>
          <SummaryCard
            label={isSeller ? t('dashboard.ordersReceived') : t('dashboard.totalOrders')}
            value={reportLoading ? '…' : (report?.order_count ?? (loading ? '…' : totalOrders))}
          />
          <SummaryCard
            label={isSeller ? t('dashboard.totalRevenue') : t('dashboard.totalSpend')}
            value={reportLoading ? '…' : totalValue}
          />
          <SummaryCard
            label={t('dashboard.pendingOrders')}
            value={loading ? '…' : pendingCount}
          />
          {isSeller ? (
            <SummaryCard label={t('dashboard.ordersShipped')} value={loading ? '…' : shippedCount} />
          ) : (
            <SummaryCard label={t('dashboard.recurringTemplates')} value={loading ? '…' : recurringTemplates} />
          )}
        </div>
      </section>

      {/* Recent orders table */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {isSeller ? t('dashboard.recentReceivedOrders') : t('dashboard.recentOrders')}
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
                      <td className={styles.mono}>{getOrderName(order.id)}</td>
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
          <h2 className={styles.sectionTitle}>{t('dashboard.quickActions')}</h2>
          <div className={styles.actionsRow}>
            <button className={styles.btn} onClick={() => navigate('/orders/new')}>
              {t('dashboard.createOrder')}
            </button>
            <button className={styles.btn} onClick={() => navigate('/templates/new')}>
              {t('dashboard.newTemplate')}
            </button>
          </div>
        </section>
      )}

      {/* Seller quick actions */}
      {isSeller && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('dashboard.quickActions')}</h2>
          <div className={styles.actionsRow}>
            <button className={styles.btn} onClick={() => navigate('/received-orders')}>
              {t('dashboard.viewAllReceived')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
