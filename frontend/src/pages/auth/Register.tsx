import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../../context/AuthContext';
import styles from './Auth.module.css';

function Register() {
  const { register, setRole } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRoleState]                  = useState<UserRole>('buyer');
  const [error, setError]                     = useState<string | null>(null);
  const [loading, setLoading]                 = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, passwordConfirm);
      // Role is stored immediately; externalId is derived from email automatically
      setRole(role);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
            Get started in{' '}
            <span className={styles.panelTaglineAccent}>minutes.</span>
          </p>
          <p className={styles.panelSubtext}>
            Create your account and start managing UBL-compliant purchase orders straight away.
          </p>
          <div className={styles.panelFeatures}>
            <div className={styles.panelFeature}>
              <span className={styles.panelFeatureDot} />
              Buyers issue orders — sellers receive and fulfil them
            </div>
            <div className={styles.panelFeature}>
              <span className={styles.panelFeatureDot} />
              Fully compliant with the UBL 2.1 international standard
            </div>
            <div className={styles.panelFeature}>
              <span className={styles.panelFeatureDot} />
              Real-time currency conversion across major currencies
            </div>
          </div>
        </div>

        <p className={styles.panelFooter}>© 2025 Northbound</p>
      </div>

      {/* Right form side */}
      <div className={styles.formSide}>
        <div className={styles.card}>
          <p className={styles.heading}>Create your account</p>
          <p className={styles.subheading}>Start managing orders with Northbound</p>

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
              <p className={styles.fieldHint}>
                Your email is used as your unique party ID — it links your orders to your account.
              </p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <input
                id="password"
                className={styles.input}
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="passwordConfirm">Confirm password</label>
              <input
                id="passwordConfirm"
                className={styles.input}
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>

            {/* Role selector */}
            <div className={styles.field}>
              <label className={styles.label}>I am a…</label>
              <div className={styles.roleGrid}>
                <button
                  type="button"
                  className={`${styles.roleCard} ${role === 'buyer' ? styles.roleCardActive : ''}`}
                  onClick={() => setRoleState('buyer')}
                >
                  <span className={styles.roleIcon}>🛒</span>
                  <span className={styles.roleTitle}>Buyer</span>
                  <span className={styles.roleDesc}>I create and send purchase orders to suppliers</span>
                </button>
                <button
                  type="button"
                  className={`${styles.roleCard} ${role === 'seller' ? styles.roleCardActive : ''}`}
                  onClick={() => setRoleState('seller')}
                >
                  <span className={styles.roleIcon}>📦</span>
                  <span className={styles.roleTitle}>Seller</span>
                  <span className={styles.roleDesc}>I receive orders and fulfil them for buyers</span>
                </button>
              </div>
              {role === 'seller' && (
                <p className={styles.fieldHint}>
                  Share your email address with buyers so they can reference you when placing orders.
                </p>
              )}
            </div>

            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <hr className={styles.divider} />
          <div className={styles.footer}>
            Already have an account?{' '}
            <Link className={styles.link} to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
