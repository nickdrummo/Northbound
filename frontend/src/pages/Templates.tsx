import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useTemplateNames } from '../hooks/useTemplateNames';
import { useLanguage } from '../context/LanguageContext';
import { deleteRecurringOrder } from '../api/recurring';
import s from '../styles/shared.module.css';

export default function Templates() {
  const { orders, loading, error, refetch } = useOrders();
  const { getName, removeTemplateName } = useTemplateNames();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const templates = orders.filter((o) => o.is_recurring);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRecurringOrder(deleteTarget);
      removeTemplateName(deleteTarget);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  }

  const FREQ_BADGE: Record<string, string> = {
    DAILY: s.badgeYellow,
    WEEKLY: s.badgeBlue,
    MONTHLY: s.badgeGreen,
  };

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>{t('templates.title')}</h1>
          <p className={s.pageSubtitle}>{t('templates.subtitle')}</p>
        </div>
        <button className={s.btnPrimary} onClick={() => navigate('/templates/new')}>
          {t('templates.newTemplate')}
        </button>
      </div>

      {error && <p className={s.error}>{t('templates.loadError')}: {error}</p>}
      {deleteError && <p className={s.error}>{deleteError}</p>}

      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('templates.col.name')}</th>
            <th>{t('templates.col.currency')}</th>
            <th>{t('templates.col.frequency')}</th>
            <th>{t('templates.col.interval')}</th>
            <th>{t('templates.col.startDate')}</th>
            <th>{t('templates.col.endDate')}</th>
            <th>{t('templates.col.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className={s.loadingCell}>{t('templates.loading')}</td></tr>
          ) : templates.length === 0 ? (
            <tr><td colSpan={7} className={s.emptyCell}>{t('templates.empty')}</td></tr>
          ) : (
            templates.map((tpl) => (
              <tr key={tpl.id}>
                <td title={tpl.id} style={{ fontWeight: 600, color: '#0f172a' }}>{getName(tpl.id)}</td>
                <td>{tpl.currency}</td>
                <td>
                  <span className={`${s.badge} ${FREQ_BADGE[tpl.frequency ?? ''] ?? s.badgeBlue}`}>
                    {tpl.frequency ?? '—'}
                  </span>
                </td>
                <td>{tpl.recur_interval ?? '—'}</td>
                <td>{tpl.recur_start_date ?? '—'}</td>
                <td>{tpl.recur_end_date ?? t('templates.ongoing')}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={s.btnSecondary}
                      style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                      onClick={() => navigate(`/templates/${tpl.id}/edit`)}
                    >
                      {t('templates.edit')}
                    </button>
                    <button
                      className={s.btnDanger}
                      style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                      onClick={() => setDeleteTarget(tpl.id)}
                    >
                      {t('templates.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {deleteTarget && (
        <div className={s.overlay}>
          <div className={s.dialog}>
            <p className={s.dialogTitle}>{t('templates.deleteConfirm')}</p>
            <p className={s.dialogBody}>
              {t('templates.deleteBodyPrefix')} <strong>{getName(deleteTarget)}</strong> {t('templates.deleteBodySuffix')}
            </p>
            <div className={s.dialogActions}>
              <button className={s.btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {t('common.cancel')}
              </button>
              <button className={s.btnDanger} onClick={handleDelete} disabled={deleting}>
                {deleting ? t('templates.deleting') : t('templates.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
