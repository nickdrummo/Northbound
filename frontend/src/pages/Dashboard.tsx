import SummaryCard from '../components/dashboard/SummaryCard';
import styles from './Dashboard.module.css';

function Dashboard() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Northbound</h1>
        <p className={styles.subtitle}>University event procurement dashboard</p>
      </div>

      <section className={styles.section}>
        <div className={styles.summaryGrid}>
          <SummaryCard label="Total Orders" value="—" />
          <SummaryCard label="Active Suppliers" value="—" />
          <SummaryCard label="Pending Orders" value="—" />
          <SummaryCard label="Recurring Templates" value="—" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Orders</h2>
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
            <tr>
              <td colSpan={5} className={styles.loadingCell}>No orders yet.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default Dashboard;
