import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useMyOrders } from '../hooks/useMyOrders';
import { useOrderStatus, OrderStatus } from '../hooks/useOrderStatus';
import s from '../styles/shared.module.css';

type Filter = 'all' | 'one-off' | 'recurring';

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending:   s.badgeYellow,
  shipped:   s.badgeBlue,
  delivered: s.badgeGreen,
};

export default function Orders() {
  const { orders, loading, error } = useMyOrders();
  const { role, externalId } = useAuth();
  const { getStatus } = useOrderStatus();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');
  const navigate = useNavigate();

  const filtered = orders.filter((o) => {
    if (filter === 'one-off') return !o.is_recurring;
    if (filter === 'recurring') return o.is_recurring;
    return true;
  });

  const roleLabel = role === 'seller' ? t('orders.role.seller') : t('orders.role.buyer');
  const subtitle = externalId
    ? t('orders.subtitleFor').replace('{role}', roleLabel).replace('{id}', externalId)
    : t('orders.setupPrompt');

  const FILTER_KEY: Record<Filter, string> = {
    'all':       'orders.filter.all',
    'one-off':   'orders.filter.oneOff',
    'recurring': 'orders.filter.recurring',
  };

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>
            {role === 'seller' ? t('orders.title.seller') : t('orders.title.buyer')}
          </h1>
          <p className={s.pageSubtitle}>{subtitle}</p>
        </div>
        {role !== 'seller' && (
          <button className={s.btnPrimary} onClick={() => navigate('/orders/new')}>
            {t('orders.newOrder')}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className={s.tabs}>
        {(['all', 'one-off', 'recurring'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`${s.tab} ${filter === f ? s.tabActive : ''}`}
          >
            {t(FILTER_KEY[f])}
          </button>
        ))}
      </div>

      {error && <p className={s.error}>{t('orders.loadError')}: {error}</p>}

      <table className={s.table}>
        <thead>
          <tr>
            <th>{t('dashboard.col.orderId')}</th>
            <th>{t('dashboard.col.currency')}</th>
            <th>{t('dashboard.col.issueDate')}</th>
            <th>{t('dashboard.col.type')}</th>
            <th>{t('dashboard.col.status')}</th>
            <th>{t('orders.col.note')}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className={s.loadingCell}>{t('dashboard.loadingOrders')}</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={6} className={s.emptyCell}>{t('dashboard.noOrders')}</td></tr>
          ) : (
            filtered.map((order) => {
              const status = getStatus(order.id);
              return (
                <tr
                  key={order.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <td className={s.mono} style={{ fontSize: '0.8rem' }}>
                    {order.id.length > 20 ? `${order.id.slice(0, 18)}…` : order.id}
                  </td>
                  <td>{order.currency}</td>
                  <td>{order.issue_date}</td>
                  <td>
                    <span className={`${s.badge} ${order.is_recurring ? s.badgePurple : s.badgeBlue}`}>
                      {order.is_recurring ? t('dashboard.type.recurring') : t('dashboard.type.oneOff')}
                    </span>
                  </td>
                  <td>
                    <span className={`${s.badge} ${STATUS_BADGE[status]}`}>
                      {t(`orders.status.${status}`)}
                    </span>
                  </td>
                  <td>{order.order_note ?? '—'}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
