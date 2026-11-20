import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  UserProfile,
  LoginInput,
  RegisterInput,
  AuthResponseData,
} from "@collab/contracts";
import { apiClient } from "../lib/apiClient";
import { useToast } from "../components/ToastProvider";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const toast = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await apiClient.get<UserProfile>("/api/auth/me");
      setUser(profile);
    } catch {
      // If token expired, try refreshing
      try {
        const refreshResult = await apiClient.post<{ user: UserProfile }>(
          "/api/auth/refresh",
          {},
        );
        setUser(refreshResult.user);
      } catch {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = async (input: LoginInput) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post<AuthResponseData>(
        "/api/auth/login",
        input,
      );
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (input: RegisterInput) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post<AuthResponseData>(
        "/api/auth/register",
        input,
      );
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post("/api/auth/logout", {});
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Could not sign out.",
      );
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
