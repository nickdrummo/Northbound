import { ReactNode } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      <Navbar />
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </>
  );
}

export default AppLayout;
