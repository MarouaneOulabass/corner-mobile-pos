'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';

const TOKEN_KEY = '_cm_t';

function initSupabaseSession() {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    supabase.auth.setSession({ access_token: token, refresh_token: '' }).catch(() => {});
  }
}

function clearSupabaseSession() {
  supabase.auth.signOut().catch(() => {});
  localStorage.removeItem(TOKEN_KEY);
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  selectedStoreId: string | null;
  setSelectedStoreId: (id: string | null) => void;
  /** For superadmin: selectedStoreId ?? null. For others: always user.store_id. */
  activeStoreId: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  selectedStoreId: null,
  setSelectedStoreId: () => {},
  activeStoreId: null,
  login: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

const STORE_KEY = 'cm_selected_store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, _setSelectedStoreId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORE_KEY) || null;
    }
    return null;
  });

  const setSelectedStoreId = (id: string | null) => {
    _setSelectedStoreId(id);
    if (id) localStorage.setItem(STORE_KEY, id);
    else localStorage.removeItem(STORE_KEY);
  };

  // For non-superadmin, activeStoreId is always user.store_id
  const activeStoreId = user?.role === 'superadmin'
    ? selectedStoreId
    : (user?.store_id ?? null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        initSupabaseSession(); // restore Supabase auth from localStorage on page load
      } else {
        setUser(null);
        clearSupabaseSession();
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok) {
        setUser(data.user);
        // Store token for Supabase RLS and init session
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
          supabase.auth.setSession({ access_token: data.token, refresh_token: '' }).catch(() => {});
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Identifiants incorrects' };
    } catch {
      return { success: false, error: 'Erreur de connexion' };
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    clearSupabaseSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, selectedStoreId, setSelectedStoreId, activeStoreId, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
