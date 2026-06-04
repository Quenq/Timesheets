import { useEffect, useState } from 'react';
import api from '../services/api';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUser() {
    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch (err: any) {
      console.error('Failed to fetch user:', err);
      localStorage.removeItem('token');
      setUser(null);
      // Force redirect to login so stale tokens don't leave a blank screen
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      setError(null);
      const response = await api.login(email, password);
      localStorage.setItem('token', response.token);
      setUser(response.user);
      return true;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Login failed';
      setError(message);
      return false;
    }
  }

  async function register(email: string, password: string, role: string, company_name?: string) {
    try {
      setError(null);
      const response = await api.register(email, password, role, company_name);
      localStorage.setItem('token', response.token);
      setUser(response.user);
      return true;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Registration failed';
      setError(message);
      return false;
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return { user, loading, error, login, register, logout, fetchUser };
}
