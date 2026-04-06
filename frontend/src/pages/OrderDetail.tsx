import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrder } from '../hooks/useOrder';
import { useAuth } from '../context/AuthContext';
import { useOrderStatus, OrderStatus } from '../hooks/useOrderStatus';
import { useExchangeRates } from '../hooks/useExchangeRates';
import {
  cancelOrder,
  updatePartyCountry,
  fetchOrderDetails,
  ParsedOrderDetails,
  Party,
} from '../api/orders';
import { createDespatch, getDespatch, CreateDespatchResult } from '../api/despatch';
import s from '../styles/shared.module.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ISO 3166-1 alpha-2 codes the backend validates against
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AU', name: 'Australia' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'AE', name: 'UAE' },
];

const DISPLAY_CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'SGD', 'JPY', 'CNY', 'INR'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Pending',
  shipped:   'Shipped',
  delivered: 'Delivered',
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending:   s.badgeYellow,
  shipped:   s.badgeBlue,
  delivered: s.badgeGreen,
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { order, loading, error } = useOrder(id!);
  const { getStatus, updateStatus } = useOrderStatus();
  const { loading: ratesLoading, convert } = useExchangeRates();

  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling]   = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Parsed order details from XML (lines + party names)
  const [details, setDetails]           = useState<ParsedOrderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Party update state — stores full Party objects returned by PATCH
  const [updatedParties, setUpdatedParties] = useState<{ buyer: Party; seller: Party } | null>(null);

  // Party country edit state
  const [countryRole, setCountryRole]   = useState<'buyer' | 'seller'>('buyer');
  const [countryCode, setCountryCode]   = useState('AU');
  const [countrySubmitting, setCountrySubmitting] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [countrySuccess, setCountrySuccess] = useState(false);

  // Currency conversion display
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null);

  // Despatch advice state
  const [despatchResult, setDespatchResult]   = useState<CreateDespatchResult | null>(null);
  const [despatchXml, setDespatchXml]         = useState<string | null>(null);
  const [despatchLoading, setDespatchLoading] = useState(false);
  const [despatchError, setDespatchError]     = useState<string | null>(null);
  const [showDespatchXml, setShowDespatchXml] = useState(false);

  // Fetch XML-based details (party names + order lines) once order is known
  useEffect(() => {
    if (!order) return;
    setDetailsLoading(true);
    setDisplayCurrency(order.currency); // default to order's own currency
    fetchOrderDetails(order.id)
      .then(setDetails)
      .catch(() => { /* non-fatal */ })
      .finally(() => setDetailsLoading(false));
  }, [order]);

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOrder(order.id);
      setShowConfirm(false);
      navigate('/orders');
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  }

  async function handleCountryUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    setCountrySubmitting(true);
    setCountryError(null);
    setCountrySuccess(false);
    try {
      const result = await updatePartyCountry(order.id, countryRole, countryCode);
      setUpdatedParties({ buyer: result.buyer, seller: result.seller });
      if (result.order_lines?.length) {
        setDetails((prev) =>
          prev
            ? {
                ...prev,
                order_lines: result.order_lines.map((l) => ({
                  line_id:     l.line_id,
                  description: l.description,
                  quantity:    l.quantity,
                  unit_price:  l.unit_price,
                  unit_code:   l.unit_code ?? 'EA',
                })),
              }
            : prev,
        );
      }
      setCountrySuccess(true);
    } catch (err) {
      setCountryError(err instanceof Error ? err.message : 'Failed to update country');
    } finally {
      setCountrySubmitting(false);
    }
  }

  async function handleCreateDespatch() {
    if (!order) return;
    setDespatchLoading(true);
    setDespatchError(null);
    try {
      const result = await createDespatch(order.id);
      setDespatchResult(result);
      // Advance status to shipped once despatch advice is created
      updateStatus(order.id, 'shipped');
      // Immediately try to retrieve the despatch XML if we got an advice ID
      if (result.adviceIds.length > 0) {
        try {
          const retrieved = await getDespatch(order.id, result.adviceIds[0]);
          if (retrieved['despatch-advice']) setDespatchXml(retrieved['despatch-advice']);
        } catch {
          // Non-fatal — advice was created, retrieval can be retried
        }
      }
    } catch (err) {
      setDespatchError(err instanceof Error ? err.message : 'Failed to create despatch advice');
    } finally {
      setDespatchLoading(false);
    }
  }

  async function handleRetrieveDespatch() {
    if (!order) return;
    setDespatchLoading(true);
    setDespatchError(null);
    try {
      const adviceId = despatchResult?.adviceIds[0];
      const retrieved = await getDespatch(order.id, adviceId);
      if (retrieved['despatch-advice']) setDespatchXml(retrieved['despatch-advice']);
      if (retrieved['advice-id'] && !despatchResult) {
        setDespatchResult({ success: true, adviceIds: [retrieved['advice-id']] });
      }
    } catch (err) {
      setDespatchError(err instanceof Error ? err.message : 'Failed to retrieve despatch advice');
    } finally {
      setDespatchLoading(false);
    }
  }

  if (loading) return <div className={s.page}><p className={s.loadingCell}>Loading order…</p></div>;
  if (error || !order) return <div className={s.page}><p className={s.error}>{error ?? 'Order not found.'}</p></div>;

  const buyerName       = updatedParties?.buyer.name    ?? details?.buyerName       ?? '';
  const buyerEndpointId = details?.buyerEndpointId ?? order.buyer_id;
  const buyerCountry    = updatedParties?.buyer.country ?? '';
  const sellerName      = updatedParties?.seller.name   ?? details?.sellerName     ?? '';
  const sellerEndpointId = details?.sellerEndpointId ?? order.seller_id;
  const sellerCountry   = updatedParties?.seller.country ?? '';

  const lines      = details?.order_lines ?? [];
  const toCurrency = displayCurrency ?? order.currency;
  const isSameCurrency = toCurrency === order.currency;

  // Grand total in display currency
  const grandTotal = lines.reduce(
    (sum, l) => sum + convert(l.quantity * l.unit_price, order.currency, toCurrency),
    0,
  );

  const orderStatus = getStatus(order.id);
  const isSeller    = role === 'seller';

  const updatedCountryName =
    COUNTRIES.find((c) => c.code === countryCode)?.name ?? countryCode;

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <button className={s.backLink} onClick={() => navigate('/orders')}>← Back to Orders</button>
          <h1 className={s.pageTitle} style={{ marginTop: 6 }}>Order Detail</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Order status badge */}
          {!order.is_recurring && (
            <span className={`${s.badge} ${STATUS_BADGE[orderStatus]}`}>
              {STATUS_LABELS[orderStatus]}
            </span>
          )}
          <a
            href={`${API_URL}/orders/${order.id}/xml`}
            target="_blank"
            rel="noreferrer"
            className={s.btnSecondary}
            style={{ textDecoration: 'none' }}
          >
            ↓ Download XML
          </a>
          {!order.is_recurring && role !== 'seller' && (
            <button className={s.btnDanger} onClick={() => setShowConfirm(true)}>
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Seller: order fulfilment actions */}
      {isSeller && !order.is_recurring && (
        <div className={s.card}>
          <p className={s.sectionHeading}>Order Fulfilment</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: despatchError ? 10 : 0 }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
              Current status:{' '}
              <span className={`${s.badge} ${STATUS_BADGE[orderStatus]}`}>
                {STATUS_LABELS[orderStatus]}
              </span>
            </span>
            {orderStatus === 'pending' && (
              <button
                className={s.btnPrimary}
                disabled={despatchLoading}
                onClick={handleCreateDespatch}
              >
                {despatchLoading ? 'Creating…' : 'Create Despatch Advice'}
              </button>
            )}
            {orderStatus === 'shipped' && !despatchResult && (
              <button
                className={s.btnSecondary}
                disabled={despatchLoading}
                onClick={handleRetrieveDespatch}
              >
                {despatchLoading ? 'Retrieving…' : 'View Despatch Advice'}
              </button>
            )}
            {orderStatus === 'shipped' && (
              <button
                className={s.btnSecondary}
                style={{ color: '#15803d', borderColor: '#bbf7d0' }}
                onClick={() => updateStatus(order.id, 'delivered')}
              >
                Mark as Delivered
              </button>
            )}
            {orderStatus === 'delivered' && (
              <span style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 600 }}>
                ✓ Order complete
              </span>
            )}
          </div>

          {despatchError && (
            <p className={s.error} style={{ marginTop: 10 }}>{despatchError}</p>
          )}

          {/* Despatch advice details */}
          {despatchResult && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
                ✓ Despatch Advice Created
              </p>
              {despatchResult.adviceIds.map((id) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Advice ID:</span>
                  <code style={{ fontSize: '0.78rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>{id}</code>
                </div>
              ))}
              {despatchXml ? (
                <div style={{ marginTop: 10 }}>
                  <button
                    className={s.btnSecondary}
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => setShowDespatchXml((v) => !v)}
                  >
                    {showDespatchXml ? 'Hide XML' : 'View Despatch XML'}
                  </button>
                  {showDespatchXml && (
                    <pre style={{
                      marginTop: 10, padding: 12, background: '#1e293b', color: '#e2e8f0',
                      borderRadius: 6, fontSize: '0.72rem', overflowX: 'auto', maxHeight: 300,
                      lineHeight: 1.5,
                    }}>
                      {despatchXml}
                    </pre>
                  )}
                </div>
              ) : (
                <button
                  className={s.btnSecondary}
                  style={{ marginTop: 8, padding: '4px 10px', fontSize: '0.78rem' }}
                  disabled={despatchLoading}
                  onClick={handleRetrieveDespatch}
                >
                  {despatchLoading ? 'Loading…' : 'Retrieve Despatch XML'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Order Information */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Order Information</p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Order ID</span>
            <span className={`${s.detailValue} ${s.mono}`}>{order.id}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Currency</span>
            <span className={s.detailValue}>{order.currency}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Issue Date</span>
            <span className={s.detailValue}>{order.issue_date}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Type</span>
            <span className={s.detailValue}>
              <span className={`${s.badge} ${order.is_recurring ? s.badgePurple : s.badgeBlue}`}>
                {order.is_recurring ? 'Recurring' : 'One-off'}
              </span>
            </span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Note</span>
            <span className={s.detailValue}>{order.order_note ?? '—'}</span>
          </div>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Created</span>
            <span className={s.detailValue}>{new Date(order.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Parties</p>
        <div className={s.detailGrid}>
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Buyer ID</span>
            <span className={`${s.detailValue} ${s.mono}`}>{buyerEndpointId}</span>
          </div>
          {buyerName && (
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Buyer Name</span>
              <span className={s.detailValue}>{buyerName}</span>
            </div>
          )}
          {buyerCountry && (
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Buyer Country</span>
              <span className={s.detailValue}>{buyerCountry}</span>
            </div>
          )}
          <div className={s.detailItem}>
            <span className={s.detailLabel}>Seller ID</span>
            <span className={`${s.detailValue} ${s.mono}`}>{sellerEndpointId}</span>
          </div>
          {sellerName && (
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Seller Name</span>
              <span className={s.detailValue}>{sellerName}</span>
            </div>
          )}
          {sellerCountry && (
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Seller Country</span>
              <span className={s.detailValue}>{sellerCountry}</span>
            </div>
          )}
        </div>

        {/* Update party country */}
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            Update Party Country
          </p>
          <form onSubmit={handleCountryUpdate} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className={s.formField} style={{ minWidth: 120 }}>
              <label>Party</label>
              <select value={countryRole} onChange={(e) => { setCountryRole(e.target.value as 'buyer' | 'seller'); setCountrySuccess(false); }}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
            <div className={s.formField} style={{ minWidth: 180 }}>
              <label>Country</label>
              <select value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setCountrySuccess(false); }}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <button type="submit" className={s.btnPrimary} disabled={countrySubmitting} style={{ marginBottom: 1 }}>
              {countrySubmitting ? 'Saving…' : 'Update'}
            </button>
          </form>
          {countryError && <p className={s.error} style={{ marginTop: 10 }}>{countryError}</p>}
          {countrySuccess && updatedParties && (
            <p className={s.success} style={{ marginTop: 10 }}>
              {countryRole === 'buyer' ? updatedParties.buyer.name : updatedParties.seller.name} country updated to{' '}
              <strong>{updatedCountryName} ({countryCode})</strong>.
            </p>
          )}
        </div>
      </div>

      {/* Order Lines + Currency Conversion */}
      {detailsLoading ? (
        <div className={s.card}><p className={s.loadingCell}>Loading order lines…</p></div>
      ) : lines.length > 0 ? (
        <div className={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p className={s.sectionHeading} style={{ margin: 0, borderBottom: 'none', padding: 0 }}>Order Lines</p>
            {/* Currency conversion selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                View in:
              </label>
              <select
                value={toCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.82rem', color: '#0f172a' }}
              >
                {DISPLAY_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {ratesLoading && <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading rates…</span>}
            </div>
          </div>
          {!isSameCurrency && (
            <p style={{ fontSize: '0.78rem', color: '#4361ee', marginBottom: 12, background: '#eff2fe', padding: '7px 12px', borderRadius: 6 }}>
              Amounts are converted from <strong>{order.currency}</strong> to <strong>{toCurrency}</strong> using live exchange rates. Original currency is {order.currency}.
            </p>
          )}
          <table className={s.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const unitPriceConverted  = convert(line.unit_price,               order.currency, toCurrency);
                const lineTotalConverted  = convert(line.quantity * line.unit_price, order.currency, toCurrency);
                return (
                  <tr key={line.line_id}>
                    <td style={{ color: '#a0aec0', fontSize: '0.8rem' }}>{i + 1}</td>
                    <td>{line.description}</td>
                    <td><span className={`${s.badge} ${s.badgeBlue}`}>{line.unit_code}</span></td>
                    <td style={{ textAlign: 'right' }}>{line.quantity}</td>
                    <td style={{ textAlign: 'right' }}>
                      {toCurrency} {unitPriceConverted.toFixed(2)}
                      {!isSameCurrency && (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8' }}>
                          {order.currency} {line.unit_price.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {toCurrency} {lineTotalConverted.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: 'right', fontWeight: 700, paddingTop: 14, borderTop: '2px solid #e8edf5', fontSize: '0.875rem', color: '#475569' }}
                >
                  Grand Total{!isSameCurrency ? ` (${toCurrency})` : ''}
                </td>
                <td
                  style={{ textAlign: 'right', fontWeight: 700, paddingTop: 14, borderTop: '2px solid #e8edf5', color: '#4361ee', fontSize: '1rem' }}
                >
                  {toCurrency} {grandTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {/* Recurrence (recurring orders only) */}
      {order.is_recurring && (
        <div className={s.card}>
          <p className={s.sectionHeading}>Recurrence</p>
          <div className={s.detailGrid}>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Frequency</span>
              <span className={s.detailValue}>{order.frequency ?? '—'}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Interval</span>
              <span className={s.detailValue}>{order.recur_interval ?? '—'}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>Start Date</span>
              <span className={s.detailValue}>{order.recur_start_date ?? '—'}</span>
            </div>
            <div className={s.detailItem}>
              <span className={s.detailLabel}>End Date</span>
              <span className={s.detailValue}>{order.recur_end_date ?? 'Ongoing'}</span>
            </div>
          </div>
        </div>
      )}

      {cancelError && <p className={s.error}>{cancelError}</p>}

      {showConfirm && (
        <div className={s.overlay}>
          <div className={s.dialog}>
            <p className={s.dialogTitle}>Cancel this order?</p>
            <p className={s.dialogBody}>
              This will permanently delete order <strong>{order.id}</strong>. This action cannot be undone.
            </p>
            <div className={s.dialogActions}>
              <button className={s.btnSecondary} onClick={() => setShowConfirm(false)} disabled={cancelling}>
                Keep Order
              </button>
              <button className={s.btnDanger} onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
