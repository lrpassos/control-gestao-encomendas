import React, { useState } from 'react';
import { signInWithEmailAndPassword, updatePassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, addDoc, query, where, limit, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { LogIn, User as UserIcon, Lock, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState(''); // Can be email or username
  const [password, setPassword] = useState('');
  
  // Password change state
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentUserData, setCurrentUserData] = useState<any>(null);

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const lowerIdentifier = identifier.toLowerCase().trim();
      let email = identifier;

      // Handle root user bootstrap
      if (lowerIdentifier === 'root') {
        email = 'root@control.com';
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
          // Firebase sometimes returns auth/invalid-credential instead of user-not-found
          // We only bootstrap if the password is 'root12345'
          if ((error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') && password === 'root12345') {
            // Bootstrap root user
            try {
              // Check if we can create the user
              const userCredential = await createUserWithEmailAndPassword(auth, email, 'root12345');
              const { user } = userCredential;
              
              // Check if a company already exists, otherwise create one
              const companiesSnap = await getDocs(query(collection(db, 'companies'), limit(1)));
              let companyId;
              
              if (companiesSnap.empty) {
                const companyRef = await addDoc(collection(db, 'companies'), {
                  name: 'Empresa Principal'
                });
                companyId = companyRef.id;
              } else {
                companyId = companiesSnap.docs[0].id;
              }

              // Check if root user already exists in Firestore
              const rootQuery = query(collection(db, 'users'), where('username', '==', 'root'), limit(1));
              const rootSnap = await getDocs(rootQuery);

              if (rootSnap.empty) {
                await setDoc(doc(db, 'users', user.uid), {
                  username: 'root',
                  email: email,
                  role: 'admin',
                  companyId: companyId,
                  active: true,
                  mustChangePassword: true
                });
              } else {
                // Update existing root doc with new UID if needed
                const existingRoot = rootSnap.docs[0];
                await updateDoc(doc(db, 'users', existingRoot.id), {
                  uid: user.uid, // Ensure UID is synced
                  mustChangePassword: true
                });
              }
              
              // Re-sign in to get the session right
              await signInWithEmailAndPassword(auth, email, 'root12345');
            } catch (createError: any) {
              if (createError.code === 'auth/email-already-in-use') {
                // User exists in Auth but password 'root12345' is wrong
                throw new Error('Usuário ou senha incorretos');
              }
              throw createError;
            }
          } else {
            throw error;
          }
        }
      } else if (!identifier.includes('@')) {
        const usersPath = 'users';
        try {
          // Try exact match first
          let q = query(collection(db, usersPath), where('username', '==', identifier), limit(1));
          let snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            // Try lowercase match
            q = query(collection(db, usersPath), where('username', '==', lowerIdentifier), limit(1));
            snapshot = await getDocs(q);
          }
          
          if (snapshot.empty) {
            toast.error('Usuário não encontrado.');
            setLoading(false);
            return;
          }
          
          email = snapshot.docs[0].data().email;
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, usersPath);
          setLoading(false);
          return;
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;

      // Check if user must change password
      const userPath = `users/${user.uid}`;
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', user.uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, userPath);
        return;
      }
      
      const userData = userDoc.data();

      if (userData?.active === false) {
        await auth.signOut();
        throw new Error('Sua conta está inativa. Entre em contato com o administrador.');
      }

      if (userData?.mustChangePassword) {
        setMustChange(true);
        setCurrentUserData({ uid: user.uid, ...userData });
        toast.info('Por favor, defina uma nova senha para continuar');
      } else {
        toast.success('Login realizado com sucesso');
      }
    } catch (error: any) {
      let message = 'Erro no login';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'Usuário ou senha incorretos';
      } else if (error.code === 'auth/user-not-found') {
        message = 'Usuário não encontrado';
      } else {
        message = error.message;
      }
      
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 4) {
      toast.error('A senha deve ter pelo menos 4 caracteres');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Usuário não autenticado');

      await updatePassword(user, newPassword);
      
      // Update Firestore flag
      const userPath = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          mustChangePassword: false
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }

      toast.success('Senha atualizada com sucesso!');
      setMustChange(false);
    } catch (error: any) {
      toast.error('Erro ao atualizar senha: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (mustChange) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6">
        <div className="w-full max-w-md space-y-8 rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-900/30 text-blue-400 mb-4">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Nova Senha</h1>
            <p className="mt-2 text-sm text-gray-400">
              Por segurança, defina uma nova senha para seu usuário.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Nova Senha</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="password"
                  required
                  className="block w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Confirmar Nova Senha</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="password"
                  required
                  className="block w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
              ) : (
                <span>Definir Nova Senha</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
          <form onSubmit={handleCredentialLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Usuário ou E-mail</label>
              <div className="relative mt-1">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="text"
                  required
                  className="block w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  placeholder="Seu usuário ou e-mail"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Senha</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="password"
                  required
                  className="block w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-gray-500">
          Ao entrar, você concorda com nossos termos de serviço.
        </div>
      </div>
    </div>
  );
}
