import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createOrder, createRecurringOrder, fetchOrders, fetchOrder, fetchOrderDetails,
  OrderInput, RecurringOrderInput, RecurringFrequency, OrderLine, Party, Order,
} from '../api/orders';
import { getDefaultCurrency } from '../hooks/usePreferences';
import { useSavedSellers } from '../hooks/useSavedSellers';
import { loadBuyerProfile } from '../hooks/useBuyerProfile';
import { useTemplateNames } from '../hooks/useTemplateNames';
import { useOrderNames } from '../hooks/useOrderNames';
import s from '../styles/shared.module.css';

const EMPTY_PARTY: Party = {
  external_id: '', name: '', email: '', street: '', city: '', country: '', postal_code: '',
};

const EMPTY_LINE: Omit<OrderLine, 'line_id'> = {
  description: '', quantity: 1, unit_price: 0, unit_code: 'EA',
};

// Backend rejects empty-string optional fields — strip them to undefined
function cleanParty(p: Party): Party {
  return {
    external_id: p.external_id,
    name: p.name,
    email:       p.email?.trim()       || undefined,
    street:      p.street?.trim()      || undefined,
    city:        p.city?.trim()        || undefined,
    country:     p.country?.trim()     || undefined,
    postal_code: p.postal_code?.trim() || undefined,
  };
}

// Defined OUTSIDE CreateOrder so React never treats it as a new component type on re-render
interface PartySectionProps {
  label: string;
  data: Party;
  onChange: (field: keyof Party, value: string) => void;
  /** When true, the external_id field is read-only (locked to the user's profile ID). */
  lockExternalId?: boolean;
}

function PartySection({ label, data, onChange, lockExternalId }: PartySectionProps) {
  return (
    <div className={s.card}>
      <p className={s.sectionHeading}>{label}</p>
      <div className={s.formGrid}>
        <div className={s.formField}>
          <label className={s.required}>ID (external_id)</label>
          {lockExternalId ? (
            <>
              <input
                value={data.external_id}
                readOnly
                style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
              />
              <p style={{ marginTop: 4, fontSize: '0.72rem', color: '#94a3b8' }}>
                Locked to your buyer profile ID. Change it in Settings.
              </p>
            </>
          ) : (
            <input value={data.external_id} required onChange={(e) => onChange('external_id', e.target.value)} />
          )}
        </div>
        <div className={s.formField}>
          <label className={s.required}>Name</label>
          <input value={data.name} required onChange={(e) => onChange('name', e.target.value)} />
        </div>
        <div className={s.formField}>
          <label>Email</label>
          <input type="email" value={data.email} onChange={(e) => onChange('email', e.target.value)} />
        </div>
        <div className={s.formField}>
          <label>Street</label>
          <input value={data.street} onChange={(e) => onChange('street', e.target.value)} />
        </div>
        <div className={s.formField}>
          <label>City</label>
          <input value={data.city} onChange={(e) => onChange('city', e.target.value)} />
        </div>
        <div className={s.formField}>
          <label>Country</label>
          <input value={data.country} onChange={(e) => onChange('country', e.target.value)} placeholder="e.g. AU" />
        </div>
        <div className={s.formField}>
          <label>Postal Code</label>
          <input value={data.postal_code} onChange={(e) => onChange('postal_code', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const { role, externalId } = useAuth();
  const { sellers: savedSellers, saveSeller, removeSeller } = useSavedSellers();
  const { getName: getTemplateName } = useTemplateNames();
  const { setOrderName } = useOrderNames();
  const [selectedSavedSellerId, setSelectedSavedSellerId] = useState('');

  // Optional user-chosen name for this order (persisted locally after creation)
  const [orderName, setOrderNameInput] = useState('');

  // Buyer external_id is always locked to the user's profile ID so orders stay discoverable
  const lockedBuyerId = (role === 'buyer' && externalId) ? externalId : '';

  // Pre-fill the buyer section from the saved buyer profile (if any).
  // external_id is still locked to the authenticated user's email when present.
  const [buyer, setBuyer] = useState<Party>(() => {
    const saved = loadBuyerProfile();
    return {
      external_id: lockedBuyerId,
      name:        saved.name,
      email:       saved.email,
      street:      saved.street,
      city:        saved.city,
      country:     saved.country,
      postal_code: saved.postal_code,
    };
  });
  const [seller, setSeller]   = useState<Party>({ ...EMPTY_PARTY });
  const [currency, setCurrency] = useState(getDefaultCurrency);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote]       = useState('');
  const [lines, setLines]     = useState<Omit<OrderLine, 'line_id'>[]>([{ ...EMPTY_LINE }]);

  // Recurring order state
  const [isRecurring, setIsRecurring]       = useState(false);
  const [frequency, setFrequency]           = useState<RecurringFrequency>('MONTHLY');
  const [recurInterval, setRecurInterval]   = useState(1);
  const [recurStartDate, setRecurStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurEndDate, setRecurEndDate]     = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Template picker state
  const [templates, setTemplates]           = useState<Order[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [applyingTemplate, setApplyingTemplate]     = useState(false);
  const [templateApplied, setTemplateApplied]       = useState(false);

  // Fetch recurring orders (templates) once on mount
  useEffect(() => {
    setTemplatesLoading(true);
    fetchOrders()
      .then((all) => setTemplates(all.filter((o) => o.is_recurring)))
      .catch(() => { /* non-fatal */ })
      .finally(() => setTemplatesLoading(false));
  }, []);

  // Sellers shouldn't be creating orders
  if (role === 'seller') {
    return (
      <div className={s.page}>
        <div className={s.pageHeader}>
          <h1 className={s.pageTitle}>New Order</h1>
        </div>
        <div className={s.card}>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Only buyers can create orders. Your account is registered as a <strong>seller</strong>.
          </p>
        </div>
      </div>
    );
  }

  function updateBuyer(field: keyof Party, value: string) {
    setBuyer((prev) => ({ ...prev, [field]: value }));
  }

  function updateSeller(field: keyof Party, value: string) {
    setSeller((prev) => ({ ...prev, [field]: value }));
  }

  function applySavedSeller(externalIdValue: string) {
    setSelectedSavedSellerId(externalIdValue);
    if (!externalIdValue) return;
    const found = savedSellers.find((s) => s.external_id === externalIdValue);
    if (!found) return;
    // Copy only the Party fields — `savedAt` is bookkeeping, not part of the payload
    setSeller({
      external_id: found.external_id,
      name:        found.name,
      email:       found.email ?? '',
      street:      found.street ?? '',
      city:        found.city ?? '',
      country:     found.country ?? '',
      postal_code: found.postal_code ?? '',
    });
  }

  function updateLine(index: number, field: keyof typeof EMPTY_LINE, value: string | number) {
    setLines((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleLoadTemplate() {
    if (!selectedTemplateId) return;
    setApplyingTemplate(true);
    setError(null);
    try {
      const [order, details] = await Promise.all([
        fetchOrder(selectedTemplateId),
        fetchOrderDetails(selectedTemplateId).catch(() => null),
      ]);

      // Recurrence settings — reset start date to today, keep interval/frequency/end
      setIsRecurring(true);
      if (order.frequency) setFrequency(order.frequency as RecurringFrequency);
      if (order.recur_interval) setRecurInterval(order.recur_interval);
      setRecurStartDate(new Date().toISOString().split('T')[0]);
      setRecurEndDate(order.recur_end_date ?? '');

      // Order meta
      setCurrency(order.currency);
      setNote(order.order_note ?? '');

      // Party data from XML — buyer external_id is locked if user is a buyer
      if (details) {
        setBuyer((prev) => ({
          ...prev,
          external_id: lockedBuyerId || details.buyerEndpointId || prev.external_id,
          name:        details.buyerName       || prev.name,
          email:       details.buyerEmail      || prev.email,
          street:      details.buyerStreet     || prev.street,
          city:        details.buyerCity       || prev.city,
          country:     details.buyerCountry    || prev.country,
          postal_code: details.buyerPostalCode || prev.postal_code,
        }));
        setSeller((prev) => ({
          ...prev,
          external_id: details.sellerEndpointId  || prev.external_id,
          name:        details.sellerName        || prev.name,
          email:       details.sellerEmail       || prev.email,
          street:      details.sellerStreet      || prev.street,
          city:        details.sellerCity        || prev.city,
          country:     details.sellerCountry     || prev.country,
          postal_code: details.sellerPostalCode  || prev.postal_code,
        }));
        if (details.order_lines.length > 0) {
          setLines(details.order_lines.map((l) => ({
            description: l.description,
            quantity:    l.quantity,
            unit_price:  l.unit_price,
            unit_code:   l.unit_code,
          })));
        }
      }

      setTemplateApplied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template.');
    } finally {
      setApplyingTemplate(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) { setError('Add at least one order line.'); return; }

    const sharedFields = {
      buyer: cleanParty(buyer),
      seller: cleanParty(seller),
      currency,
      order_note: note || undefined,
      order_lines: lines.map((l, i) => ({
        ...l,
        line_id:    `line-${i + 1}`,
        quantity:   Number(l.quantity),
        unit_price: Number(l.unit_price),
      })),
    };

    setSubmitting(true);
    setError(null);
    try {
      let result: { orderID: string };
      if (isRecurring) {
        const input: RecurringOrderInput = {
          ...sharedFields,
          frequency,
          recur_interval: Number(recurInterval),
          recur_start_date: recurStartDate,
          recur_end_date: recurEndDate || undefined,
        };
        result = await createRecurringOrder(input);
      } else {
        const input: OrderInput = {
          ...sharedFields,
          issue_date: issueDate,
        };
        result = await createOrder(input);
      }
      // Remember this seller for next time so it appears in the autofill dropdown
      saveSeller(sharedFields.seller);
      // Persist the user-chosen order name (if any) so the list can show it
      if (orderName.trim()) setOrderName(result.orderID, orderName);
      navigate(`/orders/${result.orderID}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order.');
      setSubmitting(false);
    }
  }

  return (
    <form className={s.page} onSubmit={handleSubmit}>
      <div className={s.pageHeader}>
        <div>
          <button type="button" className={s.backLink} onClick={() => navigate('/orders')}>
            ← Back to Orders
          </button>
          <h1 className={s.pageTitle} style={{ marginTop: 6 }}>New Order</h1>
        </div>
      </div>

      {/* Template picker */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Load from Recurring Template</p>
        {templatesLoading ? (
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Loading templates…</p>
        ) : templates.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            No recurring templates available.{' '}
            <button type="button" className={s.backLink} onClick={() => navigate('/templates/new')}>
              Create one
            </button>
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className={s.formField} style={{ flex: '1 1 280px', minWidth: 200, marginBottom: 0 }}>
              <label>Template</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => { setSelectedTemplateId(e.target.value); setTemplateApplied(false); }}
              >
                <option value="">— Select a template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {getTemplateName(t.id)} · {t.frequency} · every {t.recur_interval} · {t.currency}
                    {t.recur_end_date ? ` · ends ${t.recur_end_date}` : ' · ongoing'}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={s.btnSecondary}
              disabled={!selectedTemplateId || applyingTemplate}
              onClick={handleLoadTemplate}
              style={{ marginBottom: 1 }}
            >
              {applyingTemplate ? 'Applying…' : 'Apply Template'}
            </button>
          </div>
        )}
        {templateApplied && (
          <p style={{ fontSize: '0.8rem', color: '#15803d', marginTop: 10, fontWeight: 500 }}>
            ✓ Template applied — review and adjust the fields below before submitting.
          </p>
        )}
      </div>

      <PartySection label="Buyer (Your Organisation)" data={buyer} onChange={updateBuyer} lockExternalId={!!lockedBuyerId} />

      {/* Saved seller picker — lets users re-use suppliers from previous orders */}
      {savedSellers.length > 0 && (
        <div className={s.card}>
          <p className={s.sectionHeading}>Load a Saved Supplier</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className={s.formField} style={{ flex: '1 1 280px', minWidth: 200, marginBottom: 0 }}>
              <label>Saved Suppliers</label>
              <select
                value={selectedSavedSellerId}
                onChange={(e) => applySavedSeller(e.target.value)}
              >
                <option value="">— Select a saved supplier —</option>
                {savedSellers.map((sv) => (
                  <option key={sv.external_id} value={sv.external_id}>
                    {sv.name} · {sv.external_id}
                  </option>
                ))}
              </select>
            </div>
            {selectedSavedSellerId && (
              <button
                type="button"
                className={s.btnSecondary}
                onClick={() => {
                  removeSeller(selectedSavedSellerId);
                  setSelectedSavedSellerId('');
                }}
                style={{ marginBottom: 1 }}
                title="Forget this supplier"
              >
                Forget
              </button>
            )}
          </div>
          <p style={{ marginTop: 10, fontSize: '0.78rem', color: '#94a3b8' }}>
            Selecting a supplier pre-fills the seller fields below. You can still edit them.
          </p>
        </div>
      )}

      <PartySection label="Seller (Supplier)" data={seller} onChange={updateSeller} />

      {/* Order details */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Order Details</p>
        <div className={s.formGrid}>
          <div className={s.formField} style={{ gridColumn: '1 / -1' }}>
            <label>
              Order Name{' '}
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>
                (optional — a friendly label shown in your order list)
              </span>
            </label>
            <input
              value={orderName}
              onChange={(e) => setOrderNameInput(e.target.value)}
              placeholder="e.g. Q2 Office Supplies"
            />
          </div>
          <div className={s.formField}>
            <label className={s.required}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'SGD', 'JPY'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {!isRecurring && (
            <div className={s.formField}>
              <label className={s.required}>Issue Date</label>
              <input type="date" value={issueDate} required={!isRecurring} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
          )}
          <div className={s.formField} style={{ gridColumn: '1 / -1' }}>
            <label>Order Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note about this order" />
          </div>
          {/* Recurring toggle */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="isRecurring"
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="isRecurring" style={{ fontSize: '0.875rem', color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
              Make this a recurring order
            </label>
          </div>
        </div>

        {/* Recurring fields */}
        {isRecurring && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Recurrence Schedule
            </p>
            <div className={s.formGrid}>
              <div className={s.formField}>
                <label className={s.required}>Frequency</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div className={s.formField}>
                <label className={s.required}>Every</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number" min={1} value={recurInterval} required={isRecurring}
                    onChange={(e) => setRecurInterval(Number(e.target.value))}
                    style={{ width: 80 }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {frequency === 'DAILY' ? 'day(s)' : frequency === 'WEEKLY' ? 'week(s)' : 'month(s)'}
                  </span>
                </div>
              </div>
              <div className={s.formField}>
                <label className={s.required}>Start Date</label>
                <input type="date" value={recurStartDate} required={isRecurring} onChange={(e) => setRecurStartDate(e.target.value)} />
              </div>
              <div className={s.formField}>
                <label>End Date <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>(optional — leave blank for ongoing)</span></label>
                <input type="date" value={recurEndDate} min={recurStartDate} onChange={(e) => setRecurEndDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order lines */}
      <div className={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className={s.sectionHeading} style={{ margin: 0, borderBottom: 'none', padding: 0 }}>Order Lines</p>
          <button type="button" className={s.btnSecondary} style={{ padding: '5px 14px', fontSize: '0.8rem' }} onClick={addLine}>
            + Add Line
          </button>
        </div>
        <table className={s.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Description *</th>
              <th>Qty *</th>
              <th>Unit Price *</th>
              <th>Unit Code</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td style={{ color: '#a0aec0', fontSize: '0.8rem' }}>{i + 1}</td>
                <td>
                  <input
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: '0.875rem' }}
                    value={line.description} required
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    placeholder="Item description"
                  />
                </td>
                <td>
                  <input
                    style={{ width: 70, padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: '0.875rem' }}
                    type="number" min={1} value={line.quantity} required
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    style={{ width: 90, padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: '0.875rem' }}
                    type="number" min={0} step="0.01" value={line.unit_price} required
                    onChange={(e) => updateLine(i, 'unit_price', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    style={{ padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: '0.875rem' }}
                    value={line.unit_code}
                    onChange={(e) => updateLine(i, 'unit_code', e.target.value)}
                  >
                    {['EA', 'KG', 'L', 'HR', 'DAY', 'BOX', 'PKG'].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)}
                      style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '1rem' }}>
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className={s.error}>{error}</p>}

      <div className={s.formActions}>
        <button type="button" className={s.btnSecondary} onClick={() => navigate('/orders')}>
          Cancel
        </button>
        <button type="submit" className={s.btnPrimary} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Order'}
        </button>
      </div>
    </form>
  );
}
