/**
 * LinerNotes Auth Context
 * Manages authentication state and provides auth methods to the app
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api-client';
import type { User } from '@linernotes/core';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, handle: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setIsLoading(true);
      const userData = await api.getUserData();

      if (userData) {
        // Verify session is still valid
        const response = await api.getMe();
        if (response.authenticated) {
          setUser(response.user);
        } else {
          // Session expired
          await api.clearAuth();
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await api.clearAuth();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await api.loginWithEmail(email, password);
      setUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async function signup(
    email: string,
    password: string,
    handle: string,
    displayName: string
  ) {
    try {
      const response = await api.signupWithEmail(email, password, handle, displayName);
      setUser(response.user);
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await api.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  async function refreshUser() {
    try {
      const response = await api.getCurrentUser();
      setUser(response);
      await api.setUserData(response);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
