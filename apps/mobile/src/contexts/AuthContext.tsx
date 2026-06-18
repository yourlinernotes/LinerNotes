/**
 * LinerNotes Auth Context
 * Manages authentication state and provides auth methods to the app
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api-client';
import type { User } from '../lib/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (token: string, isAccessToken?: boolean) => Promise<void>;
  signup: (email: string, password: string, handle: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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
        const user = await api.getCurrentUser();
        setUser(user);
        await api.setUserData(user);
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
      const response = await api.login({ email, password });
      api.setAuthToken(response.token);
      setUser(response.user);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async function loginWithGoogle(token: string, isAccessToken = false) {
    try {
      const response = await api.loginWithGoogle(token, isAccessToken);
      api.setAuthToken(response.token);
      setUser(response.user);

      // The backend auto-generates a handle/displayName for new Google users, so
      // those fields can't distinguish a first sign-in. Use a local onboarding
      // flag instead: onboard until this device has completed it once.
      const onboarded = await api.isOnboarded();
      setNeedsOnboarding(!onboarded);
    } catch (error) {
      console.error('Google login failed:', error);
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
      const response = await api.signup({ email, password, handle, displayName });
      api.setAuthToken(response.token);
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

  async function completeOnboarding() {
    await api.setOnboarded();
    setNeedsOnboarding(false);
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    needsOnboarding,
    loginWithGoogle,
    login,
    signup,
    logout,
    refreshUser,
    completeOnboarding,
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
