import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { LANGUAGES, LanguageCode, useLanguage } from '../context/LanguageContext';
import { usePreferences } from '../hooks/usePreferences';
import { useBuyerProfile } from '../hooks/useBuyerProfile';
import s from '../styles/shared.module.css';

const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'SGD', 'JPY'];

export default function Settings() {
  const { userID, email, role, setRole, logout } = useAuth();
  const navigate = useNavigate();
  const { prefs, updatePreferences } = usePreferences();
  const { language, setLanguage, t } = useLanguage();
  const { profile, updateProfile } = useBuyerProfile();

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
            <span className={s.detailLabel}>{t('settings.userId')}</span>
            <span className={s.mono}>{userID}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>{t('settings.email')}</span>
            <span className={s.detailValue}>{email ?? '—'}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>{t('settings.session')}</span>
            <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.875rem' }}>{t('settings.sessionActive')}</span>
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
          {t('settings.partyIdentityDesc')}
          {role === 'seller' && (
            <> {t('settings.partyIdentityDescSellerSuffix')}</>
          )}
        </p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>{t('settings.partyIdLabel')}</span>
            <span
              className={s.mono}
              style={{ color: '#4361ee', fontWeight: 600, fontSize: '0.875rem' }}
            >
              {email ?? '—'}
            </span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>{t('settings.roleLabel')}</span>
            <span className={s.detailValue}>
              {role ? (
                <span className={`${s.badge} ${role === 'seller' ? s.badgePurple : s.badgeBlue}`}>
                  {t(`settings.role.${role}`)}
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
          {t('settings.roleDesc')}
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
              }}
            >
              {t(`settings.role.${r}`)}
            </button>
          ))}
        </div>
        <button
          className={s.btnPrimary}
          onClick={handleSaveRole}
          disabled={pendingRole === role}
        >
          {t('settings.saveRole')}
        </button>
        {roleSaved && (
          <span className={s.success} style={{ display: 'inline-block', marginLeft: 12, padding: '5px 12px' }}>
            {t('settings.saved')}
          </span>
        )}
      </div>

      {/* Buyer profile — used to auto-fill the buyer section on Create Order / Template */}
      {role !== 'seller' && (
        <div className={s.card}>
          <p className={s.sectionHeading}>{t('settings.buyerProfile')}</p>
          <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 16 }}>
            {t('settings.buyerProfileDesc')}
          </p>
          <div className={s.formGrid}>
            <div className={s.formField}>
              <label>{t('profile.orgName')}</label>
              <input
                value={profile.name}
                onChange={(e) => updateProfile({ name: e.target.value })}
                placeholder={t('profile.orgNamePlaceholder')}
              />
            </div>
            <div className={s.formField}>
              <label>{t('profile.contactEmail')}</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => updateProfile({ email: e.target.value })}
                placeholder={t('profile.contactEmailPlaceholder')}
              />
            </div>
            <div className={s.formField}>
              <label>{t('profile.street')}</label>
              <input
                value={profile.street}
                onChange={(e) => updateProfile({ street: e.target.value })}
              />
            </div>
            <div className={s.formField}>
              <label>{t('profile.city')}</label>
              <input
                value={profile.city}
                onChange={(e) => updateProfile({ city: e.target.value })}
              />
            </div>
            <div className={s.formField}>
              <label>{t('profile.country')}</label>
              <input
                value={profile.country}
                onChange={(e) => updateProfile({ country: e.target.value })}
                placeholder={t('profile.countryPlaceholder')}
              />
            </div>
            <div className={s.formField}>
              <label>{t('profile.postalCode')}</label>
              <input
                value={profile.postal_code}
                onChange={(e) => updateProfile({ postal_code: e.target.value })}
              />
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: '0.78rem', color: '#94a3b8' }}>
            {t('settings.savedInstantly')}
          </p>
        </div>
      )}

      {/* Preferences section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>{t('settings.preferences')}</p>
        <p style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: 16 }}>
          {t('settings.preferencesDesc')}
        </p>
        <div className={s.formGrid}>
          <div className={s.formField}>
            <label>{t('settings.defaultCurrency')}</label>
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
          {t('settings.savedInstantly')}
        </p>
      </div>

      {/* Platform section */}
      <div className={s.card}>
        <p className={s.sectionHeading}>{t('settings.platform')}</p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>{t('settings.platform.application')}</span>
            <span className={s.detailValue}>{t('brand.name')}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>{t('settings.platform.purpose')}</span>
            <span className={s.detailValue}>{t('settings.platform.purposeValue')}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>{t('settings.platform.docStandard')}</span>
            <span className={s.detailValue}>UBL 2.1</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>{t('settings.platform.backendUrl')}</span>
            <span className={s.mono}>
              {import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
