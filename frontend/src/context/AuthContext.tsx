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
  AuthResponse,
} from '../api/auth';

interface AuthState {
  token: string | null;
  userID: number | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'northbound_token';
const USER_KEY = 'northbound_user_id';

function loadPersistedAuth(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userID = localStorage.getItem(USER_KEY);
    if (token && userID) {
      return { token, userID: Number(userID), isAuthenticated: true };
    }
  } catch {
    // localStorage unavailable — fall through
  }
  return { token: null, userID: null, isAuthenticated: false };
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
        setAuth({ token: null, userID: null, isAuthenticated: false });
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    persistAuth(data);
    setAuth({ token: data.token, userID: data.userID, isAuthenticated: true });
  }, []);

  const register = useCallback(
    async (email: string, password: string, passwordConfirm: string) => {
      const data = await apiRegister(email, password, passwordConfirm);
      persistAuth(data);
      setAuth({
        token: data.token,
        userID: data.userID,
        isAuthenticated: true,
      });
    },
    [],
  );

  const logout = useCallback(() => {
    clearPersistedAuth();
    setAuth({ token: null, userID: null, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...auth, login, register, logout }}
    >
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
