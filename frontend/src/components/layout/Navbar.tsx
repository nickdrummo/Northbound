import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import styles from './Navbar.module.css';

function Navbar() {
  const { t } = useLanguage();
  return (
    <header className={styles.navbar}>
      <span className={styles.brand}>
        <span className={styles.brandDot} />
        {t('brand.name')}
      </span>
      <div className={styles.actions}>
        <LanguageSwitcher />
      </div>
    </header>
  );
}

export default Navbar;
