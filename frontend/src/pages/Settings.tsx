import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import s from '../styles/shared.module.css';

export default function Settings() {
  const { userID, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Settings</h1>
          <p className={s.pageSubtitle}>Account and platform preferences</p>
        </div>
      </div>

      {/* Account section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Account</p>
        <div className={s.detailGrid}>
          <span className={s.detailLabel}>User ID</span>
          <span className={s.mono}>{userID}</span>

          <span className={s.detailLabel}>Session</span>
          <span style={{ color: '#38a169', fontWeight: 500 }}>Active</span>
        </div>
        <div style={{ marginTop: 20 }}>
          <button className={s.btnDanger} style={{ padding: '7px 20px' }} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      {/* Platform section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Platform</p>
        <div className={s.detailGrid}>
          <span className={s.detailLabel}>Application</span>
          <span>Northbound</span>

          <span className={s.detailLabel}>Purpose</span>
          <span>University event procurement for student societies</span>

          <span className={s.detailLabel}>Document Standard</span>
          <span>PEPPOL BIS Billing 3.0 (UBL 2.1)</span>

          <span className={s.detailLabel}>Supported Currencies</span>
          <span>AUD, USD, GBP, EUR, NZD</span>
        </div>
      </div>

      {/* API section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>API</p>
        <div className={s.detailGrid}>
          <span className={s.detailLabel}>Backend URL</span>
          <span className={s.mono} style={{ fontSize: '0.85rem' }}>
            {import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}
          </span>

          <span className={s.detailLabel}>Order routes</span>
          <span>/orders (alias /v1/orders)</span>
        </div>
      </div>
    </div>
  );
}
