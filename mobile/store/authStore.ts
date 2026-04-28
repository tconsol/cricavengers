import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '@services/api';
import { tokenStorage } from '@services/tokenStorage';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  stats: Record<string, number>;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  restoreSession: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const SECURE_KEYS = {
  ACCESS:  'ca_access_token',
  REFRESH: 'ca_refresh_token',
  USER:    'ca_user',
};

export const useAuthStore = create<AuthState>((set, get) => {
  // Register the logout handler so api.ts can trigger it on token refresh failure
  tokenStorage.registerLogout(() => get().logout());

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,

    setTokens: (accessToken, refreshToken) => {
      tokenStorage.setTokens(accessToken, refreshToken);
      set({ accessToken, refreshToken });
      SecureStore.setItemAsync(SECURE_KEYS.ACCESS, accessToken);
      SecureStore.setItemAsync(SECURE_KEYS.REFRESH, refreshToken);
    },

    login: async (email, password) => {
      const res = await api.postNoAuth('/auth/login', { email, password }) as any;
      const { user, accessToken, refreshToken } = res.data;
      tokenStorage.setTokens(accessToken, refreshToken);
      set({ user, accessToken, refreshToken, isAuthenticated: true });
      await Promise.all([
        SecureStore.setItemAsync(SECURE_KEYS.ACCESS, accessToken),
        SecureStore.setItemAsync(SECURE_KEYS.REFRESH, refreshToken),
        SecureStore.setItemAsync(SECURE_KEYS.USER, JSON.stringify(user)),
      ]);
    },

    register: async (name, email, password) => {
      const res = await api.postNoAuth('/auth/register', { name, email, password }) as any;
      const { user, accessToken, refreshToken } = res.data;
      tokenStorage.setTokens(accessToken, refreshToken);
      set({ user, accessToken, refreshToken, isAuthenticated: true });
      await Promise.all([
        SecureStore.setItemAsync(SECURE_KEYS.ACCESS, accessToken),
        SecureStore.setItemAsync(SECURE_KEYS.REFRESH, refreshToken),
        SecureStore.setItemAsync(SECURE_KEYS.USER, JSON.stringify(user)),
      ]);
    },

    logout: async () => {
      const { refreshToken } = get();
      try {
        if (refreshToken) await api.post('/auth/logout', { refreshToken });
      } catch { /* ignore */ }
      tokenStorage.clearTokens();
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      await Promise.all([
        SecureStore.deleteItemAsync(SECURE_KEYS.ACCESS),
        SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH),
        SecureStore.deleteItemAsync(SECURE_KEYS.USER),
      ]);
    },

    restoreSession: async () => {
      try {
        const [accessToken, refreshToken, userRaw] = await Promise.all([
          SecureStore.getItemAsync(SECURE_KEYS.ACCESS),
          SecureStore.getItemAsync(SECURE_KEYS.REFRESH),
          SecureStore.getItemAsync(SECURE_KEYS.USER),
        ]);
        if (accessToken && refreshToken) {
          tokenStorage.setTokens(accessToken, refreshToken);
          const user = userRaw ? JSON.parse(userRaw) : null;
          set({ accessToken, refreshToken, user, isAuthenticated: true });
        }
      } catch { /* clear broken state */ }
      set({ isLoading: false });
    },

    updateUser: (updates) => {
      const user = { ...get().user!, ...updates };
      set({ user });
      SecureStore.setItemAsync(SECURE_KEYS.USER, JSON.stringify(user));
    },
  };
});
