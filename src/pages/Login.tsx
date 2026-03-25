import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, addDoc, query, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      const userCredential = await signInWithPopup(auth, provider);
      const { user } = userCredential;

      // Check if profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Check if any users exist to determine if this is the first user (admin)
        const usersQuery = query(collection(db, 'users'), limit(1));
        const usersSnapshot = await getDocs(usersQuery);
        const isFirstUser = usersSnapshot.empty;

        // Create a default company for the first user
        const companyRef = await addDoc(collection(db, 'companies'), {
          name: 'Empresa Padrão'
        });

        // Create user profile
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: isFirstUser ? 'admin' : 'company_user',
          companyId: companyRef.id
        });

        toast.success('Conta configurada com sucesso');
      } else {
        toast.success('Login realizado com sucesso');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">CONTROL</h1>
          <p className="mt-2 text-sm text-gray-400">
            Acesse sua conta para gerenciar sua logística
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center space-x-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
            ) : (
              <>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Entrar com Google</span>
              </>
            )}
          </button>
        </div>

        <div className="text-center text-xs text-gray-500">
          Ao entrar, você concorda com nossos termos de serviço.
        </div>
      </div>
    </div>
  );
}
