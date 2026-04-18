import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { LANGUAGES, LanguageCode, useLanguage } from '../context/LanguageContext';
import { usePreferences } from '../hooks/usePreferences';
import s from '../styles/shared.module.css';

const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'SGD', 'JPY'];

export default function Settings() {
  const { userID, email, role, setRole, logout } = useAuth();
  const navigate = useNavigate();
  const { prefs, updatePreferences } = usePreferences();
  const { language, setLanguage, t } = useLanguage();

  const [pendingRole, setPendingRole] = useState<UserRole>(role ?? 'buyer');
  const [roleSaved, setRoleSaved]     = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleSaveRole() {
    setRole(pendingRole);
    setRoleSaved(true);
    setTimeout(() => setRoleSaved(false), 2500);
  }

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>{t('settings.title')}</h1>
          <p className={s.pageSubtitle}>{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* Account section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>{t('settings.account')}</p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>User ID</span>
            <span className={s.mono}>{userID}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Email</span>
            <span className={s.detailValue}>{email ?? '—'}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Session</span>
            <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.875rem' }}>Active</span>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <button className={s.btnDanger} onClick={handleLogout}>
            {t('common.logout')}
          </button>
        </div>
      </div>

      {/* Party ID — read-only, derived from email */}
      <div className={s.card}>
        <p className={s.sectionHeading}>{t('settings.partyIdentity')}</p>
        <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 16 }}>
          Your party ID is automatically set to your email address and cannot be changed.
          {role === 'seller' && (
            <> Share it with buyers so they can reference you when placing orders.</>
          )}
        </p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Party ID (external_id)</span>
            <span
              className={s.mono}
              style={{ color: '#4361ee', fontWeight: 600, fontSize: '0.875rem' }}
            >
              {email ?? '—'}
            </span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Role</span>
            <span className={s.detailValue}>
              {role ? (
                <span className={`${s.badge} ${role === 'seller' ? s.badgePurple : s.badgeBlue}`}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              ) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Role selector */}
      <div className={s.card}>
        <p className={s.sectionHeading}>{t('settings.role')}</p>
        <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 18 }}>
          Your role determines what you can do in Northbound. Buyers create orders; sellers receive and fulfil them.
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {(['buyer', 'seller'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setPendingRole(r); setRoleSaved(false); }}
              style={{
                padding: '8px 20px',
                border: `2px solid ${pendingRole === r ? '#4361ee' : '#e2e8f0'}`,
                borderRadius: 8,
                background: pendingRole === r ? '#eff2fe' : '#fff',
                color: pendingRole === r ? '#3451d1' : '#64748b',
                fontWeight: pendingRole === r ? 700 : 500,
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
        <button
          className={s.btnPrimary}
          onClick={handleSaveRole}
          disabled={pendingRole === role}
        >
          Save Role
        </button>
        {roleSaved && (
          <span className={s.success} style={{ display: 'inline-block', marginLeft: 12, padding: '5px 12px' }}>
            Saved!
          </span>
        )}
      </div>

      {/* Preferences section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>{t('settings.preferences')}</p>
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
          <div className={s.formField}>
            <label>{t('settings.language')}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.label}
                </option>
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
        <p className={s.sectionHeading}>{t('settings.platform')}</p>
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
