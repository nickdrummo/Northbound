import { useNavigate } from 'react-router-dom';
import SummaryCard from '../components/dashboard/SummaryCard';
import { useOrders } from '../hooks/useOrders';
import styles from './Dashboard.module.css';

function Dashboard() {
  const navigate = useNavigate();
  const { orders, loading, error } = useOrders();

  const totalOrders = orders.length;
  const recurringTemplates = orders.filter((o) => o.is_recurring).length;

  // TODO: Wire once backend exposes GET /suppliers (distinct sellers)
  const activeSuppliersPlaceholder = '—';
  // TODO: Wire once backend adds a status field to orders
  const pendingOrdersPlaceholder = '—';

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime())
    .slice(0, 5);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Purchase order management for your business</p>
      </div>

      <section className={styles.section}>
        <div className={styles.summaryGrid}>
          <SummaryCard label="Total Orders" value={loading ? '…' : totalOrders} />
          <SummaryCard label="Active Suppliers" value={activeSuppliersPlaceholder} />
          <SummaryCard label="Pending Orders" value={pendingOrdersPlaceholder} />
          <SummaryCard label="Recurring Templates" value={loading ? '…' : recurringTemplates} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Orders</h2>
        {error && <p className={styles.error}>Could not load orders: {error}</p>}
        {!error && (
          <table className={styles.table}>
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
                <tr>
                  <td colSpan={5} className={styles.loadingCell}>Loading orders…</td>
                </tr>
              ) : recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.loadingCell}>No orders found.</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className={styles.mono}>{order.id}</td>
                    <td>{order.currency}</td>
                    <td>{order.issue_date}</td>
                    <td>
                      <span className={order.is_recurring ? styles.statusProcessing : styles.statusCompleted}>
                        {order.is_recurring ? 'Recurring' : 'One-off'}
                      </span>
                    </td>
                    <td>{order.order_note ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.actionsRow}>
          <button className={styles.btn} onClick={() => navigate('/orders/new')}>Create Order</button>
          <button className={styles.btn} onClick={() => navigate('/templates/new')}>New Template</button>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
