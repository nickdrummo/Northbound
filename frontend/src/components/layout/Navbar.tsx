import styles from './Navbar.module.css';

function Navbar() {
  return (
    <header className={styles.navbar}>
      <span className={styles.brand}>Northbound</span>
    </header>
  );
}

export default Navbar;
