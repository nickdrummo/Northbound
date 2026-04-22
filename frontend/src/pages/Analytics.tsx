import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useMyOrders } from '../hooks/useMyOrders';
import { useOrderStatus, OrderStatus } from '../hooks/useOrderStatus';
import { useOrderNames } from '../hooks/useOrderNames';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { fetchBuyerInsights, fetchSellerInsights, PartyInsightsSession } from '../api/parties';
import { useExchangeRates } from '../hooks/useExchangeRates';
import s from '../styles/shared.module.css';

// ── helpers ────────────────────────────────────────────────────────────────

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'Unknown' : d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
}

function truncateLabel(label: string, max = 18): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const PIE_COLORS = ['#4361ee', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];

// Simple inline progress bar (not Recharts)
function InlineBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '0.78rem', color: '#64748b', minWidth: 24, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// Stat card
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={s.card} style={{ flex: '1 1 180px', minWidth: 140 }}>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#94a3b8', margin: '0 0 8px' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.8rem', fontWeight: 800, color: color ?? '#0f172a', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '6px 0 0' }}>{sub}</p>}
    </div>
  );
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:   '#f59e0b',
  shipped:   '#4361ee',
  delivered: '#10b981',
};

const STATUS_KEYS: Record<OrderStatus, string> = {
  pending:   'analytics.stat.pending',
  shipped:   'analytics.stat.shipped',
  delivered: 'analytics.stat.delivered',
};

// ── page ───────────────────────────────────────────────────────────────────

export default function Analytics() {
  const navigate  = useNavigate();
  const { role, externalId }  = useAuth();
  const { orders, loading, error } = useMyOrders();
  const { getStatus } = useOrderStatus();
  const { getName: getOrderName } = useOrderNames();
  const { t } = useLanguage();
  const { rates, loading: fxLoading, convert } = useExchangeRates();

  const [baseCurrency, setBaseCurrency] = useState('AUD');
  const [insights, setInsights] = useState<PartyInsightsSession | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    if (!externalId || !role) return;
    setInsightsLoading(true);
    const fetcher = role === 'seller' ? fetchSellerInsights : fetchBuyerInsights;
    fetcher(externalId)
      .then((r) => setInsights(r))
      .catch(() => setInsights(null))
      .finally(() => setInsightsLoading(false));
  }, [externalId, role]);

  const stats = useMemo(() => {
    const total     = orders.length;
    const recurring = orders.filter((o) => o.is_recurring).length;
    const oneOff    = total - recurring;

    // Status breakdown (reads from localStorage via useOrderStatus)
    const statusCounts = countBy(orders, (o) => getStatus(o.id));

    // Currency breakdown
    const currencyCounts = countBy(orders, (o) => o.currency);

    // Frequency breakdown (recurring only)
    const freqCounts = countBy(
      orders.filter((o) => o.is_recurring && o.frequency),
      (o) => o.frequency ?? 'UNKNOWN',
    );

    // Orders by month (using issue_date or recur_start_date)
    const monthCounts = countBy(orders, (o) => monthLabel(o.issue_date ?? o.recur_start_date ?? ''));

    // Sort months chronologically (last 6)
    const sortedMonths = Object.entries(monthCounts)
      .sort(([a], [b]) => new Date('01 ' + a).getTime() - new Date('01 ' + b).getTime())
      .slice(-6);

    // Recent orders (last 5 by created_at)
    const recent = [...orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    return { total, recurring, oneOff, statusCounts, currencyCounts, freqCounts, sortedMonths, recent };
  }, [orders, getStatus]);

  const insightsStats = useMemo(() => {
    const insightOrders = insights?.orders ?? [];

    const orderValue = (orderLines: Array<{ quantity: number; unit_price: number }>) =>
      orderLines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

    let totalBase = 0;
    const currencyTotals: Record<string, number> = {};
    const monthlyValueBase: Record<string, number> = {};
    const productQty: Record<string, number> = {};
    const productValueBase: Record<string, number> = {};
    const counterpartyValueBase: Record<string, { name: string; value: number }> = {};

    for (const o of insightOrders) {
      const raw = orderValue(o.order_lines);
      const base = convert(raw, o.currency, baseCurrency);
      totalBase += base;

      const monthKey = monthLabel(o.issue_date);
      monthlyValueBase[monthKey] = (monthlyValueBase[monthKey] ?? 0) + base;

      currencyTotals[o.currency] = (currencyTotals[o.currency] ?? 0) + raw;

      for (const line of o.order_lines) {
        const key = (line.description ?? '').trim() || 'Unknown product';
        productQty[key] = (productQty[key] ?? 0) + line.quantity;
        const lineRaw = line.quantity * line.unit_price;
        const lineBase = convert(lineRaw, o.currency, baseCurrency);
        productValueBase[key] = (productValueBase[key] ?? 0) + lineBase;
      }

      const cpKey = o.counterparty.external_id;
      const existing = counterpartyValueBase[cpKey];
      if (!existing) {
        counterpartyValueBase[cpKey] = { name: o.counterparty.name, value: base };
      } else {
        existing.value += base;
      }
    }

    const topProductsByQty = Object.entries(productQty)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const topProductsByValue = Object.entries(productValueBase)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const topCounterparties = Object.entries(counterpartyValueBase)
      .sort(([, a], [, b]) => b.value - a.value)
      .slice(0, 5)
      .map(([external_id, v]) => ({ external_id, name: v.name, value: v.value }));

    const currencyTotalsSorted = Object.entries(currencyTotals)
      .sort(([, a], [, b]) => b - a);

    const monthlyBaseSeries = Object.entries(monthlyValueBase)
      .sort(([a], [b]) => new Date('01 ' + a).getTime() - new Date('01 ' + b).getTime())
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));

    return {
      totalBase,
      currencyTotalsSorted,
      topProductsByQty,
      topProductsByValue,
      topCounterparties,
      monthlyBaseSeries,
    };
  }, [insights, convert, baseCurrency]);

  const chartData = useMemo(() => {
    const ordersPerMonth = stats.sortedMonths.map(([month, count]) => ({ month, count }));

    const statusSeries = (['pending', 'shipped', 'delivered'] as OrderStatus[])
      .map((status) => ({
        name: t(STATUS_KEYS[status]),
        value: stats.statusCounts[status] ?? 0,
        fill: STATUS_COLORS[status],
      }))
      .filter((d) => d.value > 0);

    const currencyByCount = Object.entries(stats.currencyCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], i) => ({
        name,
        value,
        fill: PIE_COLORS[i % PIE_COLORS.length],
      }));

    const recurringFreq =
      stats.recurring > 0
        ? Object.entries(stats.freqCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([freq, count]) => ({
              name: t(`analytics.freq.${freq}`),
              count,
            }))
        : [];

    const topBuyersSellers = insightsStats.topCounterparties.map((cp) => ({
      name: truncateLabel(cp.name, 20),
      value: Math.round(cp.value * 100) / 100,
    }));

    const topProductsQty = insightsStats.topProductsByQty.map(([product, qty]) => ({
      name: truncateLabel(product, 22),
      quantity: qty,
    }));

    const topProductsValue = insightsStats.topProductsByValue.map(([product, val]) => ({
      name: truncateLabel(product, 22),
      value: Math.round(val * 100) / 100,
    }));

    return {
      ordersPerMonth,
      statusSeries,
      currencyByCount,
      recurringFreq,
      monthlyValue: insightsStats.monthlyBaseSeries,
      topBuyersSellers,
      topProductsQty,
      topProductsValue,
    };
  }, [stats, insightsStats, t]);

  const chartWrap = { width: '100%', height: 280 } as const;

  if (loading) return <div className={s.page}><p className={s.loadingCell}>{t('analytics.loading')}</p></div>;
  if (error)   return <div className={s.page}><p className={s.error}>{error}</p></div>;

  const maxMonth   = Math.max(...stats.sortedMonths.map(([, v]) => v), 1);
  const maxStatus  = Math.max(...Object.values(stats.statusCounts), 1);
  const maxCurr    = Math.max(...Object.values(stats.currencyCounts), 1);

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
          <h1 className={s.pageTitle}>{t('analytics.title')}</h1>
          <p className={s.pageSubtitle}>
            {role === 'seller' ? t('analytics.subtitle.seller') : t('analytics.subtitle.buyer')}
          </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Base currency</span>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white' }}
            >
              {['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'CAD', 'JPY', 'SGD'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {stats.total === 0 ? (
        <div className={s.card} style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('analytics.empty')}</p>
        </div>
      ) : (
        <>
          {/* ── Visual reports (charts first) ── */}
          <div style={{ marginBottom: 24 }}>
            <p className={s.sectionHeading} style={{ marginBottom: 16 }}>
              Report overview
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
                gap: 20,
              }}
            >
              <div className={s.card}>
                <p className={s.sectionHeading}>{t('analytics.ordersPerMonth')}</p>
                <div style={chartWrap}>
                  {chartData.ordersPerMonth.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>No data.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.ordersPerMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={36} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                          labelStyle={{ color: '#334155' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name="Orders"
                          stroke="#4361ee"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#4361ee' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className={s.card}>
                <p className={s.sectionHeading}>
                  {role === 'seller' ? 'Revenue by month' : 'Spend by month'} ({baseCurrency})
                </p>
                <div style={chartWrap}>
                  {insightsLoading || fxLoading || !rates ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Loading…</p>
                  ) : chartData.monthlyValue.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                      No order value data yet.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.monthlyValue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={48} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                          formatter={(v: number) => [`${v.toFixed(2)} ${baseCurrency}`, 'Total']}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          name={baseCurrency}
                          stroke="#7c3aed"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#7c3aed' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className={s.card}>
                <p className={s.sectionHeading}>{t('analytics.byStatus')}</p>
                <div style={chartWrap}>
                  {chartData.statusSeries.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>No status data.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData.statusSeries}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={88}
                          paddingAngle={2}
                          label={({ name, percent }) =>
                            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                        >
                          {chartData.statusSeries.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} stroke="#fff" strokeWidth={1} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className={s.card}>
                <p className={s.sectionHeading}>{t('analytics.byCurrency')}</p>
                <div style={chartWrap}>
                  {chartData.currencyByCount.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>No data.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData.currencyByCount}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={88}
                          paddingAngle={2}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {chartData.currencyByCount.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} stroke="#fff" strokeWidth={1} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {chartData.topBuyersSellers.length > 0 && (
                <div className={s.card}>
                  <p className={s.sectionHeading}>
                    {role === 'seller' ? 'Top buyers' : 'Top sellers'} ({baseCurrency})
                  </p>
                  <div style={chartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData.topBuyersSellers}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                          formatter={(v: number) => [`${v.toFixed(2)} ${baseCurrency}`, 'Total']}
                        />
                        <RechartsBar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {chartData.topProductsQty.length > 0 && (
                <div className={s.card}>
                  <p className={s.sectionHeading}>Top products by quantity</p>
                  <div style={chartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.topProductsQty} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-28} textAnchor="end" height={56} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={36} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                        <RechartsBar dataKey="quantity" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {chartData.topProductsValue.length > 0 && fxLoading === false && rates && (
                <div className={s.card}>
                  <p className={s.sectionHeading}>Top products by value ({baseCurrency})</p>
                  <div style={chartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.topProductsValue} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-28} textAnchor="end" height={56} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={44} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                          formatter={(v: number) => [`${v.toFixed(2)} ${baseCurrency}`, 'Value']}
                        />
                        <RechartsBar dataKey="value" fill="#4361ee" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {chartData.recurringFreq.length > 0 && (
                <div className={s.card}>
                  <p className={s.sectionHeading}>{t('analytics.recurringFrequency')}</p>
                  <div style={chartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.recurringFreq} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} width={36} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
                        <RechartsBar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Top stat cards ── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <StatCard label={t('analytics.stat.totalOrders')} value={stats.total} />
            <StatCard label={t('analytics.stat.oneOff')}      value={stats.oneOff}    color="#4361ee" />
            <StatCard label={t('analytics.stat.recurring')}   value={stats.recurring} color="#7c3aed" />
            <StatCard label={t('analytics.stat.pending')}     value={stats.statusCounts['pending']   ?? 0} color="#f59e0b" />
            <StatCard label={t('analytics.stat.shipped')}     value={stats.statusCounts['shipped']   ?? 0} color="#4361ee" />
            <StatCard label={t('analytics.stat.delivered')}   value={stats.statusCounts['delivered'] ?? 0} color="#10b981" />
            <StatCard
              label={role === 'seller' ? `Revenue (${baseCurrency})` : `Spend (${baseCurrency})`}
              value={
                insightsLoading || fxLoading || !rates
                  ? '…'
                  : insightsStats.totalBase.toFixed(2)
              }
              sub={insights ? undefined : 'No insights yet'}
              color="#0f172a"
            />
          </div>

          {/* ── Insights section ── */}
          {insights && insights.orders.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 20 }}>
              <div className={s.card}>
                <p className={s.sectionHeading}>
                  {role === 'seller' ? 'Top buyers' : 'Top sellers'} ({baseCurrency})
                </p>
                {fxLoading || !rates ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Loading exchange rates…</p>
                ) : insightsStats.topCounterparties.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>No data.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {insightsStats.topCounterparties.map((cp) => (
                      <div key={cp.external_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cp.name}
                        </span>
                        <span className={s.mono} style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {cp.value.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={s.card}>
                <p className={s.sectionHeading}>Top products by quantity</p>
                {insightsStats.topProductsByQty.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>No data.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {insightsStats.topProductsByQty.map(([product, qty]) => (
                      <div key={product}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.82rem', color: '#374151', fontWeight: 500 }}>{product}</span>
                        </div>
                        <InlineBar value={qty} max={Math.max(...insightsStats.topProductsByQty.map(([, v]) => v), 1)} color="#7c3aed" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={s.card}>
                <p className={s.sectionHeading}>Top products by value ({baseCurrency})</p>
                {fxLoading || !rates ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Loading exchange rates…</p>
                ) : insightsStats.topProductsByValue.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>No data.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {insightsStats.topProductsByValue.map(([product, value]) => (
                      <div key={product}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.82rem', color: '#374151', fontWeight: 500 }}>{product}</span>
                        </div>
                        <InlineBar value={Math.round(value)} max={Math.max(...insightsStats.topProductsByValue.map(([, v]) => Math.round(v)), 1)} color="#4361ee" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {/* ── Orders by status ── */}
            <div className={s.card}>
              <p className={s.sectionHeading}>{t('analytics.byStatus')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(['pending', 'shipped', 'delivered'] as OrderStatus[]).map((status) => (
                  <div key={status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{t(STATUS_KEYS[status])}</span>
                    </div>
                    <InlineBar value={stats.statusCounts[status] ?? 0} max={maxStatus} color={STATUS_COLORS[status]} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Orders by currency ── */}
            <div className={s.card}>
              <p className={s.sectionHeading}>{t('analytics.byCurrency')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(stats.currencyCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([currency, count]) => (
                    <div key={currency}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{currency}</span>
                      </div>
                      <InlineBar value={count} max={maxCurr} color="#4361ee" />
                    </div>
                  ))}
              </div>
            </div>

            {/* ── Recurring frequency breakdown (only shown if there are recurring orders) ── */}
            {stats.recurring > 0 && (
              <div className={s.card}>
                <p className={s.sectionHeading}>{t('analytics.recurringFrequency')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Object.entries(stats.freqCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([freq, count]) => (
                      <div key={freq}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>
                            {t(`analytics.freq.${freq}`)}
                          </span>
                        </div>
                        <InlineBar value={count} max={stats.recurring} color="#7c3aed" />
                      </div>
                    ))}
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                    {t('analytics.recurringOfTotal')
                      .replace('{n}', String(stats.recurring))
                      .replace('{total}', String(stats.total))}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Orders per month ── */}
          {stats.sortedMonths.length > 0 && (
            <div className={s.card}>
              <p className={s.sectionHeading}>{t('analytics.ordersPerMonth')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {stats.sortedMonths.map(([month, count]) => (
                  <div key={month}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{month}</span>
                    </div>
                    <InlineBar value={count} max={maxMonth} color="#4361ee" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent orders ── */}
          <div className={s.card}>
            <p className={s.sectionHeading}>{t('analytics.recentOrders')}</p>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('dashboard.col.orderId')}</th>
                  <th>{t('analytics.col.date')}</th>
                  <th>{t('dashboard.col.currency')}</th>
                  <th>{t('dashboard.col.type')}</th>
                  <th>{t('dashboard.col.status')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((order) => {
                  const status = getStatus(order.id);
                  return (
                    <tr
                      key={order.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <td className={s.mono} style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {getOrderName(order.id)}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {order.issue_date ?? order.recur_start_date ?? '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{order.currency}</td>
                      <td>
                        <span className={`${s.badge} ${order.is_recurring ? s.badgePurple : s.badgeBlue}`}
                          style={{ fontSize: '0.72rem' }}>
                          {order.is_recurring ? t('dashboard.type.recurring') : t('dashboard.type.oneOff')}
                        </span>
                      </td>
                      <td>
                        <span className={`${s.badge} ${
                          status === 'delivered' ? s.badgeGreen :
                          status === 'shipped'   ? s.badgeBlue  :
                          s.badgeYellow
                        }`} style={{ fontSize: '0.72rem' }}>
                          {t(STATUS_KEYS[status])}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
