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
  isAuthenticated: boolean;
  role: UserRole | null;
  externalId: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<void>;
  logout: () => void;
  /** Store buyer/seller role and the party external ID for this user. */
  setProfile: (role: UserRole, externalId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'northbound_token';
const USER_KEY  = 'northbound_user_id';
const ROLE_KEY  = 'northbound_role';
const EID_KEY   = 'northbound_external_id';

function loadPersistedAuth(): AuthState {
  try {
    const token      = localStorage.getItem(TOKEN_KEY);
    const userID     = localStorage.getItem(USER_KEY);
    const role       = localStorage.getItem(ROLE_KEY) as UserRole | null;
    const externalId = localStorage.getItem(EID_KEY);
    if (token && userID) {
      return {
        token,
        userID: Number(userID),
        isAuthenticated: true,
        role: role ?? null,
        externalId: externalId ?? null,
      };
    }
  } catch {
    // localStorage unavailable — fall through
  }
  return { token: null, userID: null, isAuthenticated: false, role: null, externalId: null };
}

function persistAuth(data: AuthResponse): void {
  try {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, String(data.userID));
  } catch {
    // silently fail if storage unavailable
  }
}

function clearPersistedAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(EID_KEY);
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
        setAuth({ token: null, userID: null, isAuthenticated: false, role: null, externalId: null });
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    persistAuth(data);
    // Preserve existing role/externalId on login (set during register or previous session)
    const role       = localStorage.getItem(ROLE_KEY) as UserRole | null;
    const externalId = localStorage.getItem(EID_KEY);
    setAuth({ token: data.token, userID: data.userID, isAuthenticated: true, role: role ?? null, externalId: externalId ?? null });
  }, []);

  const register = useCallback(
    async (email: string, password: string, passwordConfirm: string) => {
      const data = await apiRegister(email, password, passwordConfirm);
      persistAuth(data);
      const role       = localStorage.getItem(ROLE_KEY) as UserRole | null;
      const externalId = localStorage.getItem(EID_KEY);
      setAuth({
        token: data.token,
        userID: data.userID,
        isAuthenticated: true,
        role: role ?? null,
        externalId: externalId ?? null,
      });
    },
    [],
  );

  const setProfile = useCallback((role: UserRole, externalId: string) => {
    try {
      localStorage.setItem(ROLE_KEY, role);
      localStorage.setItem(EID_KEY, externalId);
    } catch {
      // silently fail
    }
    setAuth((prev) => ({ ...prev, role, externalId }));
  }, []);

  const logout = useCallback(() => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (currentToken) logoutApi(currentToken);
    clearPersistedAuth();
    setAuth({ token: null, userID: null, isAuthenticated: false, role: null, externalId: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, login, register, logout, setProfile }}>
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
