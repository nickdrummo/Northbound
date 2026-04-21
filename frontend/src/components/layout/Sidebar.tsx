import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import styles from './Sidebar.module.css';

interface NavItem {
  labelKey: string;
  path: string;
}

const BUYER_ITEMS: NavItem[] = [
  { labelKey: 'nav.dashboard', path: '/' },
  { labelKey: 'nav.myOrders',  path: '/orders' },
  { labelKey: 'nav.templates', path: '/templates' },
  { labelKey: 'nav.analytics', path: '/analytics' },
  { labelKey: 'nav.settings',  path: '/settings' },
];

const SELLER_ITEMS: NavItem[] = [
  { labelKey: 'nav.dashboard',       path: '/' },
  { labelKey: 'nav.receivedOrders',  path: '/received-orders' },
  { labelKey: 'nav.analytics',       path: '/analytics' },
  { labelKey: 'nav.settings',        path: '/settings' },
];

const DEFAULT_ITEMS: NavItem[] = [
  { labelKey: 'nav.dashboard', path: '/' },
  { labelKey: 'nav.orders',    path: '/orders' },
  { labelKey: 'nav.templates', path: '/templates' },
  { labelKey: 'nav.analytics', path: '/analytics' },
  { labelKey: 'nav.settings',  path: '/settings' },
];

function Sidebar() {
  const { role } = useAuth();
  const { t } = useLanguage();

  const navItems =
    role === 'buyer'  ? BUYER_ITEMS  :
    role === 'seller' ? SELLER_ITEMS :
    DEFAULT_ITEMS;

  return (
    <aside className={styles.sidebar}>
      <nav>
        <ul className={styles.navList}>
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
                }
              >
                {t(item.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {role && (
        <div className={styles.roleBadge}>
          <span className={styles.roleDot} />
          {role === 'buyer' ? t('nav.buyerAccount') : t('nav.sellerAccount')}
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
