import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  authApi,
  clearAuthTokens,
  hasStoredRefreshToken,
  type AuthUser,
} from "../lib/api-client";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentUser = await authApi.me();
    setUser(currentUser);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const result = await authApi.login(input);
    setUser(result.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    await authApi.register(input);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuthTokens();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initializeSession() {
      try {
        if (!hasStoredRefreshToken()) {
          return;
        }

        const refreshed = await authApi.refresh();

        if (!refreshed) {
          return;
        }

        const currentUser = await authApi.me();

        if (active) {
          setUser(currentUser);
        }
      } catch {
        clearAuthTokens();

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setIsInitializing(false);
        }
      }
    }

    void initializeSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleExpiredSession() {
      clearAuthTokens();
      setUser(null);
    }

    window.addEventListener("auth:session-expired", handleExpiredSession);

    return () => {
      window.removeEventListener("auth:session-expired", handleExpiredSession);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isInitializing,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
