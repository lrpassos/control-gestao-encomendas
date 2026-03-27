import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { toast } from 'sonner';
import { UserProfile } from './types';
import { Toaster } from 'sonner';
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

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid);
      
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeDoc = onSnapshot(userRef, (userDoc) => {
          console.log('User doc snapshot received. Exists:', userDoc.exists());
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('User data:', userData);
            if (userData.active === false) {
              auth.signOut();
              setUser(null);
              toast.error('Sua conta foi desativada.');
            } else {
              setUser({ uid: firebaseUser.uid, ...userData } as UserProfile);
            }
          } else {
            console.log('User doc does not exist yet for UID:', firebaseUser.uid);
            setUser(null);
          }
          setLoading(false);
        }, (error) => {
          console.error('Snapshot error for UID:', firebaseUser.uid, error);
          // If it's a permission error, it might be because the doc doesn't exist yet
          // and the rules are strict. We'll just set user to null and stop loading.
          setUser(null);
          setLoading(false);
          // Don't show toast for every snapshot error to avoid spamming during bootstrap
        });
      } else {
        console.log('No firebase user');
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
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
          <Route 
            path="/login" 
            element={user && !user.mustChangePassword ? <Navigate to="/" replace /> : <Login user={user} />} 
          />
          <Route
            path="/"
            element={user && !user.mustChangePassword ? <Layout user={user} setUser={setUser} /> : <Navigate to="/login" replace />}
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
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
