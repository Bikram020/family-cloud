// ============================================
// Auth Context — Global login state
// ============================================
// Provides login/logout/register throughout the app.
// Stores JWT token in SecureStore for persistence.
// ============================================

import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start, check if user is already logged in
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('token');
      const storedUser = await SecureStore.getItemAsync('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.log('No stored auth found');
    } finally {
      setLoading(false);
    }
  };

  const login = async (mobile, password) => {
    const data = await authAPI.login(mobile, password);

    // Save to state
    setToken(data.token);
    setUser(data.user);

    // Save to SecureStore (persists across app restarts)
    await SecureStore.setItemAsync('token', data.token);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));

    return data;
  };

  const register = async (mobile, username, name, password) => {
    const data = await authAPI.register(mobile, username, name, password);
    return data;
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
  };

  const value = {
    user,
    token,
    loading,
    isLoggedIn: !!token,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be inside AuthProvider');
  return context;
};
