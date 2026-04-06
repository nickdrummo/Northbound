import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Auth.module.css';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* Left branded panel */}
      <div className={styles.panel}>
        <div className={styles.panelBrand}>
          <span className={styles.panelBrandDot} />
          <span className={styles.panelBrandName}>Northbound</span>
        </div>

        <div className={styles.panelBody}>
          <p className={styles.panelTagline}>
            Purchase orders,{' '}
            <span className={styles.panelTaglineAccent}>done properly.</span>
          </p>
          <div className={styles.panelFeatures}>
            <div className={styles.panelFeature}>
              <span className={styles.panelFeatureDot} />
              Create and manage purchase orders as valid UBL 2.1 XML documents
            </div>
            <div className={styles.panelFeature}>
              <span className={styles.panelFeatureDot} />
              Set up recurring order templates to automate repeat procurement
            </div>
            <div className={styles.panelFeature}>
              <span className={styles.panelFeatureDot} />
              Download order XML for direct dispatch to your suppliers
            </div>
          </div>
        </div>

        <p className={styles.panelFooter}>© 2025 Northbound</p>
      </div>

      {/* Right form side */}
      <div className={styles.formSide}>
        <div className={styles.card}>
          <p className={styles.heading}>Welcome back</p>
          <p className={styles.subheading}>Sign in to your Northbound account</p>

          {error && <div className={styles.error}>{error}</div>}

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <input
                id="password"
                className={styles.input}
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <hr className={styles.divider} />
          <div className={styles.footer}>
            <Link className={styles.link} to="/forgot-password">Forgot password?</Link>
          </div>
          <div className={styles.footer}>
            No account?{' '}
            <Link className={styles.link} to="/register">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
