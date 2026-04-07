import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logoutApi,
  AuthResponse,
} from '../api/auth';

export type UserRole = 'buyer' | 'seller';

interface AuthState {
  token: string | null;
  userID: number | null;
  /** The authenticated user's email — also used as their party external_id. */
  email: string | null;
  isAuthenticated: boolean;
  role: UserRole | null;
}

interface AuthContextValue extends AuthState {
  /**
   * The user's party external_id — always equal to their email.
   * Derived automatically; cannot be changed by the user.
   */
  externalId: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<void>;
  logout: () => void;
  /** Store the user's buyer/seller role. externalId is always derived from email. */
  setRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'northbound_token';
const USER_KEY  = 'northbound_user_id';
const EMAIL_KEY = 'northbound_email';
const ROLE_KEY  = 'northbound_role';

function loadPersistedAuth(): AuthState {
  try {
    const token  = localStorage.getItem(TOKEN_KEY);
    const userID = localStorage.getItem(USER_KEY);
    const email  = localStorage.getItem(EMAIL_KEY);
    const role   = localStorage.getItem(ROLE_KEY) as UserRole | null;
    if (token && userID) {
      return {
        token,
        userID: Number(userID),
        email: email ?? null,
        isAuthenticated: true,
        role: role ?? null,
      };
    }
  } catch {
    // localStorage unavailable
  }
  return { token: null, userID: null, email: null, isAuthenticated: false, role: null };
}

function persistAuth(data: AuthResponse, email: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, String(data.userID));
    localStorage.setItem(EMAIL_KEY, email);
  } catch {
    // silently fail
  }
}

function clearPersistedAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EMAIL_KEY);
    // Role is intentionally kept across logout — it's a user preference tied
    // to the account, not a session secret, so the user doesn't have to
    // re-select it every time they log back in.
    localStorage.removeItem('northbound_external_id'); // legacy cleanup
  } catch {
    // silently fail
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadPersistedAuth);

  // Sync state if another tab logs out
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === TOKEN_KEY && !e.newValue) {
        setAuth({ token: null, userID: null, email: null, isAuthenticated: false, role: null });
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    persistAuth(data, email);
    const role = localStorage.getItem(ROLE_KEY) as UserRole | null;
    setAuth({ token: data.token, userID: data.userID, email, isAuthenticated: true, role: role ?? null });
  }, []);

  const register = useCallback(
    async (email: string, password: string, passwordConfirm: string) => {
      const data = await apiRegister(email, password, passwordConfirm);
      persistAuth(data, email);
      const role = localStorage.getItem(ROLE_KEY) as UserRole | null;
      setAuth({ token: data.token, userID: data.userID, email, isAuthenticated: true, role: role ?? null });
    },
    [],
  );

  const setRole = useCallback((role: UserRole) => {
    try {
      localStorage.setItem(ROLE_KEY, role);
    } catch {
      // silently fail
    }
    setAuth((prev) => ({ ...prev, role }));
  }, []);

  const logout = useCallback(() => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (currentToken) logoutApi(currentToken);
    clearPersistedAuth();
    setAuth({ token: null, userID: null, email: null, isAuthenticated: false, role: null });
  }, []);

  // externalId is always the user's email — derived, never separately stored
  const externalId = auth.email;

  return (
    <AuthContext.Provider value={{ ...auth, externalId, login, register, logout, setRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
