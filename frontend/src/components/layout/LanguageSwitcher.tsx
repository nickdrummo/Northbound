import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, LanguageCode, useLanguage } from '../../context/LanguageContext';
import styles from './LanguageSwitcher.module.css';

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  // Close the dropdown on outside click / Escape
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function select(code: LanguageCode) {
    setLanguage(code);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change language (current: ${current.label})`}
        title={current.label}
      >
        <span className={styles.flag} aria-hidden="true">{current.flag}</span>
        <span className={styles.caret} aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={styles.menu} role="listbox">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={lang.code === language}
              className={
                lang.code === language
                  ? `${styles.option} ${styles.optionActive}`
                  : styles.option
              }
              onClick={() => select(lang.code)}
            >
              <span className={styles.optionFlag} aria-hidden="true">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
