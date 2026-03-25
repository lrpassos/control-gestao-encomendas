import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db, auth } from '../firebase';
import { UserProfile, Company } from '../types';
import { UserPlus, Search, Shield, Mail, User as UserIcon, Lock, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { initializeApp, getApp, getApps } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

interface UsersProps {
  user: UserProfile;
}

export default function Users({ user }: UsersProps) {
  if (user.role !== 'admin') {
    return <Navigate to="/" />;
  }

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'company_user' as 'admin' | 'company_user'
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getSecondaryAuth = () => {
    const appName = 'Secondary';
    const app = getApps().find(a => a.name === appName) || initializeApp(firebaseConfig, appName);
    return getAuth(app);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('companyId', '==', user.companyId));
      const snapshot = await getDocs(q);
      const usersList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersList);
    } catch (error: any) {
      toast.error('Erro ao buscar usuários: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user.companyId]);

  const generateTempPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const tempPassword = generateTempPassword();
      
      // Check if username already exists
      const usernameQuery = query(collection(db, 'users'), where('username', '==', formData.username));
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
        throw new Error('Este nome de usuário já está em uso');
      }

      // If email is provided, check if it's already in use in our Firestore (optional but good)
      if (formData.email) {
        const emailQuery = query(collection(db, 'users'), where('email', '==', formData.email));
        const emailSnapshot = await getDocs(emailQuery);
        if (!emailSnapshot.empty) {
          throw new Error('Este e-mail já está em uso por outro usuário');
        }
      }

      const secondaryAuth = getSecondaryAuth();

      // Generate a unique internal email if none provided, or use the provided one
      // We add a random suffix to internal emails to ensure they never collide in Firebase Auth
      const sanitizedUsername = formData.username.toLowerCase().replace(/[^a-z0-9]/g, '.');
      const internalEmail = formData.email || `${sanitizedUsername}.${Math.random().toString(36).substring(2, 7)}@internal.control`;

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        internalEmail,
        tempPassword
      );
      
      const newUser = userCredential.user;

      await setDoc(doc(db, 'users', newUser.uid), {
        email: internalEmail,
        username: formData.username,
        role: formData.role,
        companyId: user.companyId,
        mustChangePassword: true
      });

      setGeneratedPassword(tempPassword);
      toast.success('Usuário criado com sucesso');
      fetchUsers();
    } catch (error: any) {
      let message = error.message;
      if (error.code === 'auth/email-already-in-use') {
        message = 'Este e-mail já está em uso por outra conta no sistema. Por favor, use um e-mail diferente ou deixe o campo em branco para usar apenas o nome de usuário.';
      }
      toast.error('Erro ao criar usuário: ' + message);
      setSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Senha copiada para a área de transferência');
  };

  const closeAndReset = () => {
    setIsModalOpen(false);
    setGeneratedPassword('');
    setFormData({ username: '', email: '', role: 'company_user' });
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Gestão de Usuários</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 transition-all"
        >
          <UserPlus size={18} />
          <span>Adicionar Usuário</span>
        </button>
      </div>

      <div className="rounded-xl bg-[#111] border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#161616] text-gray-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">E-mail</th>
                <th className="px-6 py-4">Função</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.uid} className="hover:bg-[#161616] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold">
                          {(u.username || u.email)[0].toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{u.username || 'Sem usuário'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-900/30 text-blue-400'
                      }`}>
                        {u.role === 'admin' ? 'Administrador' : 'Usuário'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
            {generatedPassword ? (
              <div className="text-center space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30 text-green-400">
                  <Check size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Usuário Criado!</h3>
                  <p className="mt-2 text-sm text-gray-400">
                    Compartilhe esta senha provisória com o usuário. Ele deverá alterá-la no primeiro acesso.
                  </p>
                </div>
                
                <div className="relative flex items-center justify-between rounded-lg bg-gray-900 border border-gray-800 p-4">
                  <code className="text-lg font-mono text-white">{generatedPassword}</code>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
                  </button>
                </div>

                <button
                  onClick={closeAndReset}
                  className="w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 transition-all"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white">Adicionar Novo Usuário</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Crie um novo acesso para sua empresa. Uma senha provisória será gerada.
                </p>

                <form className="mt-6 space-y-4" onSubmit={handleAddUser}>
                  <div>
                    <label className="block text-sm font-medium text-gray-400">Nome de Usuário (Login)</label>
                    <div className="relative mt-1">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input
                        type="text"
                        required
                        placeholder="ex: joao.silva"
                        className="block w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400">E-mail (Opcional)</label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input
                        type="email"
                        placeholder="ex: joao@empresa.com"
                        className="block w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400">Função</label>
                    <select
                      className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    >
                      <option value="company_user">Usuário Comum</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div className="mt-8 flex space-x-3">
                    <button
                      type="button"
                      onClick={closeAndReset}
                      className="flex-1 rounded-lg border border-gray-800 px-4 py-3 text-sm font-semibold text-gray-400 hover:bg-gray-900 hover:text-white transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                      {submitting ? 'Criando...' : 'Criar Usuário'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
