import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, addDoc, query, where, limit, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { LogIn, User as UserIcon, Lock, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'google' | 'credentials'>('google');
  const [identifier, setIdentifier] = useState(''); // Can be email or username
  const [password, setPassword] = useState('');
  
  // Password change state
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentUserData, setCurrentUserData] = useState<any>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      const userCredential = await signInWithPopup(auth, provider);
      const { user } = userCredential;

      // Check if profile exists
      const userPath = `users/${user.uid}`;
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', user.uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, userPath);
        return;
      }
      
      if (!userDoc.exists()) {
        const usersPath = 'users';
        const companiesPath = 'companies';
        
        try {
          const usersQuery = query(collection(db, usersPath), limit(1));
          const usersSnapshot = await getDocs(usersQuery);
          const isFirstUser = usersSnapshot.empty;

          const companyRef = await addDoc(collection(db, companiesPath), {
            name: 'Empresa Padrão'
          });

          await setDoc(doc(db, usersPath, user.uid), {
            email: user.email,
            role: isFirstUser ? 'admin' : 'company_user',
            companyId: companyRef.id,
            active: true
          });

          toast.success('Conta configurada com sucesso');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, usersPath);
        }
      } else {
        const userData = userDoc.data();
        if (userData.active === false) {
          await auth.signOut();
          throw new Error('Sua conta está inativa. Entre em contato com o administrador.');
        }
        toast.success('Login realizado com sucesso');
      }
    } catch (error: any) {
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('Domínio não autorizado no Firebase. Adicione ' + window.location.hostname + ' aos domínios autorizados no Console do Firebase.', {
          duration: 10000
        });
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let email = identifier;

      if (!identifier.includes('@')) {
        const usersPath = 'users';
        try {
          const q = query(collection(db, usersPath), where('username', '==', identifier), limit(1));
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            throw new Error('Usuário não encontrado');
          }
          
          email = snapshot.docs[0].data().email;
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, usersPath);
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
      toast.error('Erro no login: ' + error.message);
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

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
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
              Este é seu primeiro acesso. Por segurança, defina uma nova senha.
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
          {loginMethod === 'google' ? (
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
          ) : (
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
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#111] px-2 text-gray-500">Ou</span>
            </div>
          </div>

          <button
            onClick={() => setLoginMethod(loginMethod === 'google' ? 'credentials' : 'google')}
            className="w-full text-sm text-gray-400 hover:text-white transition-colors"
          >
            {loginMethod === 'google' ? 'Entrar com usuário e senha' : 'Entrar com Google'}
          </button>
        </div>

        <div className="text-center text-xs text-gray-500">
          Ao entrar, você concorda com nossos termos de serviço.
        </div>
      </div>
    </div>
  );
}
