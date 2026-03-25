import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { toast } from 'sonner';
import { UserProfile } from './types';
import { Toaster } from 'sonner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Distributors from './pages/Distributors';
import Shipments from './pages/Shipments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.active === false) {
            await auth.signOut();
            setUser(null);
            toast.error('Sua conta foi desativada.');
          } else {
            setUser({ uid: firebaseUser.uid, ...userData } as UserProfile);
          }
        } else {
          // Profile is missing, but don't sign out yet. 
          // The Login page will handle completing the profile.
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route
            path="/"
            element={user ? <Layout user={user} setUser={setUser} /> : <Navigate to="/login" />}
          >
            <Route index element={<Dashboard user={user} />} />
            <Route path="customers" element={<Customers user={user} />} />
            <Route path="distributors" element={<Distributors user={user} />} />
            <Route path="shipments" element={<Shipments user={user} />} />
            <Route path="reports" element={<Reports user={user} />} />
            <Route path="users" element={<Users user={user} />} />
            <Route path="settings" element={<Settings user={user} />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
