import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchOrder,
  fetchOrderDetails,
  updateOrder,
  OrderInput,
  OrderLine,
  Party,
} from '../api/orders';
import { getDefaultCurrency } from '../hooks/usePreferences';
import s from '../styles/shared.module.css';

const EMPTY_LINE: Omit<OrderLine, 'line_id'> = {
  description: '', quantity: 1, unit_price: 0, unit_code: 'EA',
};

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

interface PartySectionProps {
  label: string;
  data: Party;
  onChange: (field: keyof Party, value: string) => void;
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
              <input value={data.external_id} readOnly style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} />
              <p style={{ marginTop: 4, fontSize: '0.72rem', color: '#94a3b8' }}>Locked to your buyer profile ID.</p>
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
          <input type="email" value={data.email ?? ''} onChange={(e) => onChange('email', e.target.value)} />
        </div>
        <div className={s.formField}>
          <label>Street</label>
          <input value={data.street ?? ''} onChange={(e) => onChange('street', e.target.value)} />
        </div>
        <div className={s.formField}>
          <label>City</label>
          <input value={data.city ?? ''} onChange={(e) => onChange('city', e.target.value)} />
        </div>
        <div className={s.formField}>
          <label>Country</label>
          <input value={data.country ?? ''} onChange={(e) => onChange('country', e.target.value)} placeholder="e.g. AU" />
        </div>
        <div className={s.formField}>
          <label>Postal Code</label>
          <input value={data.postal_code ?? ''} onChange={(e) => onChange('postal_code', e.target.value)} />
        </div>
      </div>
    </div>
  );
}

export default function EditOrder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, externalId } = useAuth();

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [buyer, setBuyer]   = useState<Party>({ external_id: externalId ?? '', name: '', email: '', street: '', city: '', country: '', postal_code: '' });
  const [seller, setSeller] = useState<Party>({ external_id: '', name: '', email: '', street: '', city: '', country: '', postal_code: '' });
  const [currency, setCurrency]   = useState(getDefaultCurrency());
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderNote, setOrderNote] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([{ line_id: 'line-1', description: '', quantity: 1, unit_price: 0, unit_code: 'EA' }]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sellers cannot edit orders
  if (role === 'seller') {
    return (
      <div className={s.page}>
        <div className={s.pageHeader}><h1 className={s.pageTitle}>Edit Order</h1></div>
        <div className={s.card}>
          <p style={{ color: '#64748b' }}>Only buyers can edit orders.</p>
        </div>
      </div>
    );
  }

  // Pre-populate from existing order + XML
  useEffect(() => {
    if (!id) return;
    setInitialLoading(true);
    Promise.all([fetchOrder(id), fetchOrderDetails(id)])
      .then(([order, details]) => {
        setCurrency(order.currency);
        setIssueDate(order.issue_date);
        setOrderNote(order.order_note ?? '');
        setBuyer({
          external_id: details.buyerEndpointId || externalId || '',
          name:        details.buyerName || '',
          email: '', street: '', city: '', country: '', postal_code: '',
        });
        setSeller({
          external_id: details.sellerEndpointId || '',
          name:        details.sellerName || '',
          email: '', street: '', city: '', country: '', postal_code: '',
        });
        if (details.order_lines.length > 0) {
          setLines(details.order_lines.map((l, i) => ({
            line_id:     l.line_id || `line-${i + 1}`,
            description: l.description,
            quantity:    l.quantity,
            unit_price:  l.unit_price,
            unit_code:   l.unit_code,
          })));
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load order'))
      .finally(() => setInitialLoading(false));
  }, [id]);

  function addLine() {
    setLines((prev) => [...prev, { line_id: `line-${prev.length + 1}`, ...EMPTY_LINE }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: keyof OrderLine, value: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function updateParty(which: 'buyer' | 'seller', field: keyof Party, value: string) {
    if (which === 'buyer') setBuyer((p) => ({ ...p, [field]: value }));
    else setSeller((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) { setSubmitError('Add at least one order line.'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: OrderInput = {
        buyer:       cleanParty(buyer),
        seller:      cleanParty(seller),
        currency,
        issue_date:  issueDate,
        order_note:  orderNote.trim() || undefined,
        order_lines: lines.map((l, i) => ({
          line_id:     l.line_id || `line-${i + 1}`,
          description: l.description,
          quantity:    Number(l.quantity),
          unit_price:  Number(l.unit_price),
          unit_code:   l.unit_code || 'EA',
        })),
      };
      await updateOrder(id!, input);
      navigate(`/orders/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setSubmitting(false);
    }
  }

  if (initialLoading) return <div className={s.page}><p className={s.loadingCell}>Loading order…</p></div>;
  if (loadError) return <div className={s.page}><p className={s.error}>{loadError}</p></div>;

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div>
          <button className={s.backLink} onClick={() => navigate(`/orders/${id}`)}>← Back to Order</button>
          <h1 className={s.pageTitle} style={{ marginTop: 6 }}>Edit Order</h1>
          <p className={s.pageSubtitle}>Changes will regenerate the UBL XML for this order.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <PartySection
          label="Buyer (Your Organisation)"
          data={buyer}
          onChange={(f, v) => updateParty('buyer', f, v)}
          lockExternalId={!!externalId}
        />

        <PartySection
          label="Seller (Supplier)"
          data={seller}
          onChange={(f, v) => updateParty('seller', f, v)}
        />

        {/* Order Details */}
        <div className={s.card}>
          <p className={s.sectionHeading}>Order Details</p>
          <div className={s.formGrid}>
            <div className={s.formField}>
              <label className={s.required}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {['AUD','USD','GBP','EUR','NZD','CAD','SGD','JPY','CNY','INR'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className={s.formField}>
              <label className={s.required}>Issue Date</label>
              <input type="date" value={issueDate} required onChange={(e) => setIssueDate(e.target.value)} />
            </div>
          </div>
          <div className={s.formField} style={{ marginTop: 12 }}>
            <label>Order Note</label>
            <textarea
              value={orderNote}
              rows={3}
              placeholder="Optional note about this order"
              onChange={(e) => setOrderNote(e.target.value)}
            />
          </div>
        </div>

        {/* Order Lines */}
        <div className={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p className={s.sectionHeading} style={{ margin: 0, padding: 0, borderBottom: 'none' }}>Order Lines</p>
            <button type="button" className={s.btnSecondary} onClick={addLine}>+ Add Line</button>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ width: 100 }}>Unit</th>
                <th style={{ width: 90, textAlign: 'right' }}>Qty</th>
                <th style={{ width: 120, textAlign: 'right' }}>Unit Price</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td>
                    <input
                      value={line.description}
                      required
                      placeholder="Item description"
                      onChange={(e) => updateLine(i, 'description', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      value={line.unit_code}
                      placeholder="EA"
                      onChange={(e) => updateLine(i, 'unit_code', e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min={1} value={line.quantity} required
                      onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                      style={{ width: '100%', textAlign: 'right' }}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min={0} step="0.01" value={line.unit_price} required
                      onChange={(e) => updateLine(i, 'unit_price', Number(e.target.value))}
                      style={{ width: '100%', textAlign: 'right' }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {submitError && <p className={s.error}>{submitError}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className={s.btnSecondary} onClick={() => navigate(`/orders/${id}`)}>
            Cancel
          </button>
          <button type="submit" className={s.btnPrimary} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
