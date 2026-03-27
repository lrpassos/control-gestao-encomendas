import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogIn, User as UserIcon, Lock } from 'lucide-react';
import { signInWithCustomToken, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [initialized, setInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setInitialized(data.initialized);
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (initialized === false) {
        // Setup mode
        const res = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        
        if (res.ok) {
          toast.success('Senha de administrador definida com sucesso!');
          setInitialized(true);
          // Now login with the newly set password
          await performLogin('root', password);
        } else {
          toast.error(data.error || 'Erro ao definir senha');
        }
      } else {
        // Normal login mode
        await performLogin(identifier, password);
      }
    } catch (error: any) {
      toast.error('Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  const performLogin = async (username: string, pass: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pass }),
    });
    const data = await res.json();

    if (res.ok) {
      // Sign in to Firebase with custom token for Firestore rules
      if (data.firebaseToken) {
        await signInWithCustomToken(auth, data.firebaseToken);
      }
      
      localStorage.setItem('token', data.token);
      toast.success('Login realizado com sucesso');
      onLogin(data.user);
      navigate('/', { replace: true });
    } else {
      toast.error(data.error || 'Usuário ou senha incorretos');
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        toast.success('Login realizado com sucesso com Google');
        onLogin(data.user);
        navigate('/', { replace: true });
      } else {
        toast.error(data.error || 'Erro ao autenticar com Google');
      }
    } catch (error: any) {
      console.error('Google Login Error:', error);
      toast.error('Erro ao conectar com Google');
    } finally {
      setLoading(false);
    }
  };

  if (initialized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">CONTROL</h1>
          <p className="mt-2 text-sm text-gray-400">
            {initialized === false 
              ? 'Defina a senha de administrador para inicializar o sistema' 
              : 'Acesse sua conta para gerenciar sua logística'}
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {initialized !== false && (
              <div>
                <label className="block text-sm font-medium text-gray-400">Usuário</label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="text"
                    required
                    className="block w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                    placeholder="Seu usuário"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-400">
                {initialized === false ? 'Nova Senha de Administrador' : 'Senha'}
              </label>
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
                  <span>{initialized === false ? 'Definir Senha' : 'Entrar'}</span>
                </>
              )}
            </button>
          </form>

          {initialized !== false && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#111] px-2 text-gray-500">Ou continue com</span>
                </div>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center space-x-2 rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/firebase/anonymous-scan.png" alt="Google" className="h-5 w-5" referrerPolicy="no-referrer" />
                <span>Entrar com Google</span>
              </button>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-gray-500">
          Ao entrar, você concorda com nossos termos de serviço.
        </div>
      </div>
    </div>
  );
}
