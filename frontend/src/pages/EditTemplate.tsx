import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateRecurringOrder, RecurringFrequency } from '../api/recurring';
import { useOrder } from '../hooks/useOrder';
import s from '../styles/shared.module.css';

const FREQUENCIES: RecurringFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

export default function EditTemplate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { order, loading, error: loadError } = useOrder(id!);

  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [interval, setInterval] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [note, setNote] = useState('');
  const [initialised, setInitialised] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form once the order loads
  useEffect(() => {
    if (order && !initialised) {
      if (order.frequency) setFrequency(order.frequency as RecurringFrequency);
      if (order.recur_interval) setInterval(order.recur_interval);
      if (order.recur_start_date) setStartDate(order.recur_start_date);
      setEndDate(order.recur_end_date ?? '');
      setCurrency(order.currency);
      setNote(order.order_note ?? '');
      setInitialised(true);
    }
  }, [order, initialised]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateRecurringOrder(id!, {
        frequency,
        recur_interval: Number(interval),
        recur_start_date: startDate,
        recur_end_date: endDate || null,
        currency,
        order_note: note || undefined,
      });
      navigate('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={s.page}>
        <p className={s.loadingCell}>Loading template…</p>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className={s.page}>
        <p className={s.error}>{loadError ?? 'Template not found.'}</p>
        <button className={s.btnSecondary} onClick={() => navigate('/templates')}>
          ← Back to Templates
        </button>
      </div>
    );
  }

  return (
    <form className={s.page} onSubmit={handleSubmit}>
      <div className={s.pageHeader}>
        <div>
          <button type="button" className={s.backLink} onClick={() => navigate('/templates')}>
            ← Back to Templates
          </button>
          <h1 className={s.pageTitle} style={{ marginTop: 6 }}>
            Edit Template <span className={s.mono} style={{ fontSize: '0.85em', color: '#718096' }}>{id}</span>
          </h1>
        </div>
      </div>

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
            <input
              type="number" min={1} value={interval} required
              onChange={(e) => setInterval(Number(e.target.value))}
            />
          </div>
          <div className={s.formField}>
            <label className={s.required}>Start Date</label>
            <input
              type="date" value={startDate} required
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className={s.formField}>
            <label>End Date <span style={{ color: '#a0aec0', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className={s.formField}>
            <label className={s.required}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['AUD', 'USD', 'GBP', 'EUR', 'NZD'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className={s.formField} style={{ gridColumn: '1 / -1' }}>
            <label>Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </div>
        </div>
      </div>

      {error && <p className={s.error}>{error}</p>}
      <div className={s.formActions}>
        <button type="button" className={s.btnSecondary} onClick={() => navigate('/templates')}>
          Cancel
        </button>
        <button type="submit" className={s.btnPrimary} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
