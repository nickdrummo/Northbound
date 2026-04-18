import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useTemplateNames } from '../hooks/useTemplateNames';
import { deleteRecurringOrder } from '../api/recurring';
import s from '../styles/shared.module.css';

export default function Templates() {
  const { orders, loading, error, refetch } = useOrders();
  const { getName, removeTemplateName } = useTemplateNames();
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
          <h1 className={s.pageTitle}>Recurring Templates</h1>
          <p className={s.pageSubtitle}>Manage repeat purchase orders</p>
        </div>
        <button className={s.btnPrimary} onClick={() => navigate('/templates/new')}>
          + New Template
        </button>
      </div>

      {error && <p className={s.error}>Could not load templates: {error}</p>}
      {deleteError && <p className={s.error}>{deleteError}</p>}

      <table className={s.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Currency</th>
            <th>Frequency</th>
            <th>Interval</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className={s.loadingCell}>Loading templates…</td></tr>
          ) : templates.length === 0 ? (
            <tr><td colSpan={7} className={s.emptyCell}>No recurring templates yet.</td></tr>
          ) : (
            templates.map((t) => (
              <tr key={t.id}>
                <td title={t.id} style={{ fontWeight: 600, color: '#0f172a' }}>{getName(t.id)}</td>
                <td>{t.currency}</td>
                <td>
                  <span className={`${s.badge} ${FREQ_BADGE[t.frequency ?? ''] ?? s.badgeBlue}`}>
                    {t.frequency ?? '—'}
                  </span>
                </td>
                <td>{t.recur_interval ?? '—'}</td>
                <td>{t.recur_start_date ?? '—'}</td>
                <td>{t.recur_end_date ?? 'Ongoing'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={s.btnSecondary}
                      style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                      onClick={() => navigate(`/templates/${t.id}/edit`)}
                    >
                      Edit
                    </button>
                    <button
                      className={s.btnDanger}
                      style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                      onClick={() => setDeleteTarget(t.id)}
                    >
                      Delete
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
            <p className={s.dialogTitle}>Delete this template?</p>
            <p className={s.dialogBody}>
              Template <strong>{getName(deleteTarget)}</strong> will be permanently deleted.
              This cannot be undone.
            </p>
            <div className={s.dialogActions}>
              <button className={s.btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button className={s.btnDanger} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
