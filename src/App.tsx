import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { UserProfile } from './types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Withdrawal from './pages/Withdrawal';
import Distributors from './pages/Distributors';
import Shipments from './pages/Shipments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const userData = await res.json();
          if (userData.firebaseToken) {
            await signInWithCustomToken(auth, userData.firebaseToken);
          }
          setUser(userData);
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-white"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-right" theme="dark" />
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" replace /> : <Login onLogin={setUser} />} 
          />
          <Route
            path="/"
            element={user ? <Layout user={user} setUser={setUser} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Dashboard user={user!} />} />
            <Route path="customers" element={<Customers user={user} />} />
            <Route path="withdrawal" element={<Withdrawal user={user} />} />
            <Route path="distributors" element={<Distributors user={user} />} />
            <Route path="shipments" element={<Shipments user={user} />} />
            <Route path="reports" element={<Reports user={user} />} />
            <Route path="users" element={<Users user={user} />} />
            <Route path="settings" element={<Settings user={user} />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
