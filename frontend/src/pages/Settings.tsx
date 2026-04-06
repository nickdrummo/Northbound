import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../hooks/usePreferences';
import s from '../styles/shared.module.css';

const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD'];

export default function Settings() {
  const { userID, logout } = useAuth();
  const navigate = useNavigate();
  const { prefs, updatePreferences } = usePreferences();

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
          <div className={s.detailItem}>
            <span className={s.detailLabel}>User ID</span>
            <span className={s.mono}>{userID}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Session</span>
            <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.875rem' }}>Active</span>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <button className={s.btnDanger} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>

      {/* Preferences section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Preferences</p>
        <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 16 }}>
          These preferences are saved locally and used to pre-fill forms throughout the app.
        </p>
        <div className={s.formGrid}>
          <div className={s.formField}>
            <label>Default Currency</label>
            <select
              value={prefs.defaultCurrency}
              onChange={(e) => updatePreferences({ defaultCurrency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ marginTop: 12, fontSize: '0.78rem', color: '#94a3b8' }}>
          Saved instantly — no need to click Save.
        </p>
      </div>

      {/* Platform section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Platform</p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Application</span>
            <span className={s.detailValue}>Northbound</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Purpose</span>
            <span className={s.detailValue}>Purchase order management for small and medium businesses</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Document Standard</span>
            <span className={s.detailValue}>UBL 2.1</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Supported Currencies</span>
            <span className={s.detailValue}>AUD, USD, GBP, EUR, NZD</span>
          </div>
        </div>
      </div>

      {/* API section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>API</p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Backend URL</span>
            <span className={s.mono}>
              {import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}
            </span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Version</span>
            <span className={s.detailValue}>v1 / v2</span>
          </div>
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
