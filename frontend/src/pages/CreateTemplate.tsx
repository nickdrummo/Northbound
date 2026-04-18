import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRecurringOrder, RecurringFrequency, RecurringOrderInput } from '../api/recurring';
import { Party, OrderLine } from '../api/orders';
import { getDefaultCurrency } from '../hooks/usePreferences';
import { useSavedSellers } from '../hooks/useSavedSellers';
import s from '../styles/shared.module.css';

const EMPTY_PARTY: Party = {
  external_id: '', name: '', email: '', street: '', city: '', country: '', postal_code: '',
};

const FREQUENCIES: RecurringFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

// Defined OUTSIDE CreateTemplate so each render references the same component
// type — otherwise React remounts the inputs on every keystroke and steals focus.
interface PartySectionProps {
  which: 'buyer' | 'seller';
  data: Party;
  onChange: (field: keyof Party, value: string) => void;
}

function PartySection({ which, data, onChange }: PartySectionProps) {
  return (
    <div className={s.card}>
      <p className={s.sectionHeading}>{which === 'buyer' ? 'Buyer (Your Organisation)' : 'Seller (Supplier)'}</p>
      <div className={s.formGrid}>
        {(['external_id', 'name', 'email', 'street', 'city', 'country', 'postal_code'] as (keyof Party)[]).map((field) => (
          <div className={s.formField} key={field}>
            <label className={field === 'external_id' || field === 'name' ? s.required : ''}>
              {field.replace('_', ' ')}
            </label>
            <input
              value={data[field] ?? ''}
              required={field === 'external_id' || field === 'name'}
              onChange={(e) => onChange(field, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreateTemplate() {
  const navigate = useNavigate();
  const { sellers: savedSellers, saveSeller, removeSeller } = useSavedSellers();
  const [selectedSavedSellerId, setSelectedSavedSellerId] = useState('');

  const [buyer, setBuyer] = useState<Party>({ ...EMPTY_PARTY });
  const [seller, setSeller] = useState<Party>({ ...EMPTY_PARTY });
  const [currency, setCurrency] = useState(getDefaultCurrency);
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [interval, setInterval] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [lines, setLines] = useState<Omit<OrderLine, 'line_id'>[]>([
    { description: '', quantity: 1, unit_price: 0, unit_code: 'EA' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateParty(which: 'buyer' | 'seller', field: keyof Party, value: string) {
    (which === 'buyer' ? setBuyer : setSeller)((p) => ({ ...p, [field]: value }));
  }

  function applySavedSeller(externalIdValue: string) {
    setSelectedSavedSellerId(externalIdValue);
    if (!externalIdValue) return;
    const found = savedSellers.find((sv) => sv.external_id === externalIdValue);
    if (!found) return;
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

  function updateLine(i: number, field: string, value: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) { setError('Add at least one order line.'); return; }

    const input: RecurringOrderInput = {
      buyer, seller, currency,
      order_note: note || undefined,
      frequency,
      recur_interval: Number(interval),
      recur_start_date: startDate,
      recur_end_date: endDate || undefined,
      order_lines: lines.map((l, i) => ({
        ...l,
        line_id: `line-${i + 1}`,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
      })),
    };

    setSubmitting(true);
    setError(null);
    try {
      await createRecurringOrder(input);
      saveSeller(seller);
      navigate('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template.');
      setSubmitting(false);
    }
  }

  return (
    <form className={s.page} onSubmit={handleSubmit}>
      <div className={s.pageHeader}>
        <div>
          <button type="button" className={s.backLink} onClick={() => navigate('/templates')}>
            ← Back to Templates
          </button>
          <h1 className={s.pageTitle} style={{ marginTop: 6 }}>New Recurring Template</h1>
        </div>
      </div>

      <PartySection
        which="buyer"
        data={buyer}
        onChange={(field, value) => updateParty('buyer', field, value)}
      />

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

      <PartySection
        which="seller"
        data={seller}
        onChange={(field, value) => updateParty('seller', field, value)}
      />

      <div className={s.card}>
        <p className={s.sectionHeading}>Recurrence Settings</p>
        <div className={s.formGrid}>
          <div className={s.formField}>
            <label className={s.required}>Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className={s.formField}>
            <label className={s.required}>Interval</label>
            <input type="number" min={1} value={interval} required
              onChange={(e) => setInterval(Number(e.target.value))} />
          </div>
          <div className={s.formField}>
            <label className={s.required}>Start Date</label>
            <input type="date" value={startDate} required onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className={s.formField}>
            <label>End Date <span style={{ color: '#a0aec0', fontWeight: 400 }}>(optional)</span></label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className={s.formField}>
            <label className={s.required}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['AUD', 'USD', 'GBP', 'EUR', 'NZD'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className={s.formField} style={{ gridColumn: '1 / -1' }}>
            <label>Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
          </div>
        </div>
      </div>

      <div className={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className={s.sectionHeading} style={{ margin: 0, borderBottom: 'none', padding: 0 }}>Order Lines</p>
          <button type="button" className={s.btnSecondary} style={{ padding: '5px 14px', fontSize: '0.8rem' }}
            onClick={() => setLines((p) => [...p, { description: '', quantity: 1, unit_price: 0, unit_code: 'EA' }])}>
            + Add Line
          </button>
        </div>
        <table className={s.table}>
          <thead><tr><th>#</th><th>Description *</th><th>Qty *</th><th>Unit Price *</th><th>Unit</th><th></th></tr></thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td style={{ color: '#a0aec0', fontSize: '0.8rem' }}>{i + 1}</td>
                <td><input style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: '0.875rem' }}
                  value={line.description} required onChange={(e) => updateLine(i, 'description', e.target.value)} /></td>
                <td><input style={{ width: 70, padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: '0.875rem' }}
                  type="number" min={1} value={line.quantity} required onChange={(e) => updateLine(i, 'quantity', e.target.value)} /></td>
                <td><input style={{ width: 90, padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: '0.875rem' }}
                  type="number" min={0} step="0.01" value={line.unit_price} required onChange={(e) => updateLine(i, 'unit_price', e.target.value)} /></td>
                <td><select style={{ padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 4, fontSize: '0.875rem' }}
                  value={line.unit_code} onChange={(e) => updateLine(i, 'unit_code', e.target.value)}>
                  {['EA', 'KG', 'L', 'HR', 'DAY', 'BOX', 'PKG'].map((u) => <option key={u}>{u}</option>)}
                </select></td>
                <td>{lines.length > 1 && <button type="button" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className={s.error}>{error}</p>}
      <div className={s.formActions}>
        <button type="button" className={s.btnSecondary} onClick={() => navigate('/templates')}>Cancel</button>
        <button type="submit" className={s.btnPrimary} disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Template'}
        </button>
      </div>
    </form>
  );
}
