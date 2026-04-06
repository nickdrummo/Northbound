import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const navItems = [
  { label: 'Dashboard', path: '/' },
  { label: 'Orders', path: '/orders' },
  { label: 'Templates', path: '/templates' },
  { label: 'Settings', path: '/settings' },
];

function Sidebar() {
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
    </aside>
  );
}

export default Sidebar;
