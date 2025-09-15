'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { api } from '@/lib/api';
import { User } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  enableTwoFactor: () => Promise<{ secret: string; qrCode: string }>;
  verifyTwoFactor: (token: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (userId: string) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  countryCode?: string;
  currency?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user;

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setUser(response.data.data.user);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.success) {
        const { user: userData, token } = response.data.data;
        localStorage.setItem('token', token);
        setUser(userData);
        toast.success('Welcome back!');
        router.push('/dashboard');
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post('/auth/register', data);
      
      if (response.data.success) {
        toast.success('Account created successfully! Please check your email for verification.');
        router.push('/auth/verify-email');
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await api.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      toast.success('Logged out successfully');
      router.push('/');
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.put('/users/profile', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUser(response.data.data.user);
        toast.success('Profile updated successfully');
      } else {
        throw new Error(response.data.message || 'Update failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Update failed';
      toast.error(message);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Password changed successfully');
      } else {
        throw new Error(response.data.message || 'Password change failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Password change failed';
      toast.error(message);
      throw error;
    }
  };

  const enableTwoFactor = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.post('/auth/enable-2fa', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Two-factor authentication enabled');
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to enable 2FA');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Failed to enable 2FA';
      toast.error(message);
      throw error;
    }
  };

  const verifyTwoFactor = async (token: string) => {
    try {
      const authToken = localStorage.getItem('token');
      const response = await api.post('/auth/verify-2fa', { token }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (response.data.success) {
        toast.success('Two-factor authentication verified');
      } else {
        throw new Error(response.data.message || '2FA verification failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || '2FA verification failed';
      toast.error(message);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      
      if (response.data.success) {
        toast.success('Password reset email sent');
      } else {
        throw new Error(response.data.message || 'Password reset failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Password reset failed';
      toast.error(message);
      throw error;
    }
  };

  const confirmPasswordReset = async (token: string, newPassword: string) => {
    try {
      const response = await api.post('/auth/reset-password', { token, newPassword });
      
      if (response.data.success) {
        toast.success('Password reset successfully');
        router.push('/auth/login');
      } else {
        throw new Error(response.data.message || 'Password reset failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Password reset failed';
      toast.error(message);
      throw error;
    }
  };

  const verifyEmail = async (userId: string) => {
    try {
      const response = await api.post('/auth/verify-email', { userId });
      
      if (response.data.success) {
        toast.success('Email verified successfully');
        if (user) {
          setUser({ ...user, isVerified: true });
        }
      } else {
        throw new Error(response.data.message || 'Email verification failed');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Email verification failed';
      toast.error(message);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    enableTwoFactor,
    verifyTwoFactor,
    resetPassword,
    confirmPasswordReset,
    verifyEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}