import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Sidebar.module.css';

const BUYER_ITEMS = [
  { label: 'Dashboard',  path: '/' },
  { label: 'My Orders',  path: '/orders' },
  { label: 'Templates',  path: '/templates' },
  { label: 'Analytics',  path: '/analytics' },
  { label: 'Settings',   path: '/settings' },
];

const SELLER_ITEMS = [
  { label: 'Dashboard',        path: '/' },
  { label: 'Received Orders',  path: '/received-orders' },
  { label: 'Analytics',        path: '/analytics' },
  { label: 'Settings',         path: '/settings' },
];

const DEFAULT_ITEMS = [
  { label: 'Dashboard',  path: '/' },
  { label: 'Orders',     path: '/orders' },
  { label: 'Templates',  path: '/templates' },
  { label: 'Analytics',  path: '/analytics' },
  { label: 'Settings',   path: '/settings' },
];

function Sidebar() {
  const { role } = useAuth();

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
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {role && (
        <div className={styles.roleBadge}>
          <span className={styles.roleDot} />
          {role === 'buyer' ? 'Buyer account' : 'Seller account'}
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
