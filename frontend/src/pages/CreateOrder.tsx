import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createOrder, OrderInput, OrderLine, Party } from '../api/orders';
import { getDefaultCurrency } from '../hooks/usePreferences';
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

  // Buyer external_id is always locked to the user's profile ID so orders stay discoverable
  const lockedBuyerId = (role === 'buyer' && externalId) ? externalId : '';

  const [buyer, setBuyer] = useState<Party>({
    ...EMPTY_PARTY,
    external_id: lockedBuyerId,
  });
  const [seller, setSeller]   = useState<Party>({ ...EMPTY_PARTY });
  const [currency, setCurrency] = useState(getDefaultCurrency);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote]       = useState('');
  const [lines, setLines]     = useState<Omit<OrderLine, 'line_id'>[]>([{ ...EMPTY_LINE }]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

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

  function updateLine(index: number, field: keyof typeof EMPTY_LINE, value: string | number) {
    setLines((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) { setError('Add at least one order line.'); return; }

    const input: OrderInput = {
      buyer: cleanParty(buyer),
      seller: cleanParty(seller),
      currency,
      issue_date: issueDate,
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
      const result = await createOrder(input);
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

      <PartySection label="Buyer (Your Organisation)" data={buyer} onChange={updateBuyer} lockExternalId={!!lockedBuyerId} />
      <PartySection label="Seller (Supplier)" data={seller} onChange={updateSeller} />

      {/* Order details */}
      <div className={s.card}>
        <p className={s.sectionHeading}>Order Details</p>
        <div className={s.formGrid}>
          <div className={s.formField}>
            <label className={s.required}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['AUD', 'USD', 'GBP', 'EUR', 'NZD', 'CAD', 'SGD', 'JPY'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className={s.formField}>
            <label className={s.required}>Issue Date</label>
            <input type="date" value={issueDate} required onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className={s.formField} style={{ gridColumn: '1 / -1' }}>
            <label>Order Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note about this order" />
          </div>
        </div>
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
