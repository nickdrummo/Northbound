import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateRecurringOrder, RecurringFrequency } from '../api/recurring';
import { useOrder } from '../hooks/useOrder';
import { useTemplateNames, loadTemplateName } from '../hooks/useTemplateNames';
import { useLanguage } from '../context/LanguageContext';
import s from '../styles/shared.module.css';

const FREQUENCIES: RecurringFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

export default function EditTemplate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { order, loading, error: loadError } = useOrder(id!);
  const { setTemplateName } = useTemplateNames();
  const { t } = useLanguage();

  const [templateName, setTemplateNameInput] = useState(() => loadTemplateName(id!) ?? '');
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
      setTemplateName(id!, templateName);
      navigate('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={s.page}>
        <p className={s.loadingCell}>{t('editTemplate.loading')}</p>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className={s.page}>
        <p className={s.error}>{loadError ?? t('editTemplate.notFound')}</p>
        <button className={s.btnSecondary} onClick={() => navigate('/templates')}>
          {t('createTemplate.backToTemplates')}
        </button>
      </div>
    );
  }

  return (
    <form className={s.page} onSubmit={handleSubmit}>
      <div className={s.pageHeader}>
        <div>
          <button type="button" className={s.backLink} onClick={() => navigate('/templates')}>
            {t('createTemplate.backToTemplates')}
          </button>
          <h1 className={s.pageTitle} style={{ marginTop: 6 }}>
            {t('editTemplate.title')}
            {templateName && <span style={{ color: '#64748b', fontWeight: 500 }}> · {templateName}</span>}
          </h1>
        </div>
      </div>

      <div className={s.card}>
        <p className={s.sectionHeading}>{t('createTemplate.templateName')}</p>
        <div className={s.formField} style={{ marginBottom: 0 }}>
          <label>{t('createTemplate.nameLabel')}</label>
          <input
            value={templateName}
            onChange={(e) => setTemplateNameInput(e.target.value)}
            placeholder={t('createTemplate.namePlaceholder')}
          />
          <p style={{ marginTop: 6, fontSize: '0.78rem', color: '#94a3b8' }}>
            {t('createTemplate.nameHelpEdit')}
          </p>
        </div>
      </div>

      <div className={s.card}>
        <p className={s.sectionHeading}>{t('createTemplate.recurrenceSettings')}</p>
        <div className={s.formGrid}>
          <div className={s.formField}>
            <label className={s.required}>{t('createTemplate.frequency')}</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
              {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className={s.formField}>
            <label className={s.required}>{t('createTemplate.interval')}</label>
            <input
              type="number" min={1} value={interval} required
              onChange={(e) => setInterval(Number(e.target.value))}
            />
          </div>
          <div className={s.formField}>
            <label className={s.required}>{t('createTemplate.startDate')}</label>
            <input
              type="date" value={startDate} required
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className={s.formField}>
            <label>{t('createTemplate.endDate')} <span style={{ color: '#a0aec0', fontWeight: 400 }}>{t('createTemplate.endDateOptional')}</span></label>
            <input
              type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className={s.formField}>
            <label className={s.required}>{t('createTemplate.currency')}</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['AUD', 'USD', 'GBP', 'EUR', 'NZD'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className={s.formField} style={{ gridColumn: '1 / -1' }}>
            <label>{t('createTemplate.note')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('createTemplate.notePlaceholder')}
            />
          </div>
        </div>
      </div>

      {error && <p className={s.error}>{error}</p>}
      <div className={s.formActions}>
        <button type="button" className={s.btnSecondary} onClick={() => navigate('/templates')}>
          {t('common.cancel')}
        </button>
        <button type="submit" className={s.btnPrimary} disabled={submitting}>
          {submitting ? t('editTemplate.saving') : t('editTemplate.saveChanges')}
        </button>
      </div>
    </form>
  );
}
