import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { usePreferences } from '../hooks/usePreferences';
import s from '../styles/shared.module.css';

const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'SGD', 'JPY'];

export default function Settings() {
  const { userID, role, externalId, setProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { prefs, updatePreferences } = usePreferences();

  const [profileRole, setProfileRole]     = useState<UserRole>(role ?? 'buyer');
  const [profileEid, setProfileEid]       = useState(externalId ?? '');
  const [profileSaved, setProfileSaved]   = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleSaveProfile() {
    if (!profileEid.trim()) return;
    setProfile(profileRole, profileEid.trim());
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
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

      {/* Profile — role & externalId */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Profile</p>
        <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 18 }}>
          Your role determines what you can do in Northbound. Your party ID links your account to orders.
        </p>

        {/* Role selector */}
        <div className={s.formField} style={{ marginBottom: 16 }}>
          <label>I am a…</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {(['buyer', 'seller'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setProfileRole(r); setProfileSaved(false); }}
                style={{
                  padding: '8px 20px',
                  border: `2px solid ${profileRole === r ? '#4361ee' : '#e2e8f0'}`,
                  borderRadius: 8,
                  background: profileRole === r ? '#eff2fe' : '#fff',
                  color: profileRole === r ? '#3451d1' : '#64748b',
                  fontWeight: profileRole === r ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* External ID field */}
        <div className={s.formField} style={{ marginBottom: 18 }}>
          <label>
            {profileRole === 'seller' ? 'Seller ID (share with buyers)' : 'Buyer ID'}
          </label>
          <input
            value={profileEid}
            onChange={(e) => { setProfileEid(e.target.value); setProfileSaved(false); }}
            placeholder={profileRole === 'seller' ? 'e.g. acme-supplies' : 'e.g. your@email.com'}
            style={{ maxWidth: 360 }}
          />
          <p style={{ marginTop: 6, fontSize: '0.75rem', color: '#94a3b8' }}>
            {profileRole === 'seller'
              ? 'Buyers will enter this ID in the Seller section when creating orders. Once set, keep it consistent.'
              : 'This ID will be pre-filled as your buyer external_id when creating new orders.'}
          </p>
        </div>

        <button
          className={s.btnPrimary}
          onClick={handleSaveProfile}
          disabled={!profileEid.trim()}
        >
          Save Profile
        </button>
        {profileSaved && (
          <span className={s.success} style={{ display: 'inline-block', marginLeft: 12, padding: '5px 12px' }}>
            Saved!
          </span>
        )}
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
            <span className={s.detailLabel}>Backend URL</span>
            <span className={s.mono}>
              {import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
