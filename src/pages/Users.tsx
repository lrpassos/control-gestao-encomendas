import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db, auth } from '../firebase';
import { UserProfile, Company } from '../types';
import { UserPlus, Search, Shield, Mail, User as UserIcon, Lock, Copy, Check, Edit2, Trash2, X } from 'lucide-react';
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'company_user' as 'admin' | 'company_user',
    password: ''
  });
  const [editFormData, setEditFormData] = useState({
    username: '',
    email: '',
    role: 'company_user' as 'admin' | 'company_user'
  });
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
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

  const openAddModal = () => {
    const tempPass = generateTempPassword();
    setFormData({
      username: '',
      email: '',
      role: 'company_user',
      password: tempPass
    });
    setIsModalOpen(true);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const tempPassword = formData.password;
      
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
      setShowSuccess(true);
      toast.success('Usuário criado com sucesso');
      fetchUsers();
    } catch (error: any) {
      let message = error.message;
      if (error.code === 'auth/operation-not-allowed') {
        message = `O login por E-mail/Senha não está ativado. 
        
        VERIFIQUE NO CONSOLE:
        1. Projeto: ${firebaseConfig.projectId}
        2. Menu: Authentication > Sign-in method
        3. Provedor: E-mail/Senha (deve estar ATIVADO e SALVO).`;
      } else if (error.code === 'auth/unauthorized-domain') {
        message = `Este domínio não está autorizado no Firebase.
        
        COMO RESOLVER:
        1. Vá no Console do Firebase > Authentication > Settings > Authorized Domains.
        2. Adicione este endereço: ${window.location.hostname}`;
      }
      toast.error('Erro ao criar usuário: ' + message, {
        duration: 15000,
      });
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      // Check if username already exists (if changed)
      if (editFormData.username !== selectedUser.username) {
        const usernameQuery = query(collection(db, 'users'), where('username', '==', editFormData.username));
        const usernameSnapshot = await getDocs(usernameQuery);
        if (!usernameSnapshot.empty) {
          throw new Error('Este nome de usuário já está em uso');
        }
      }

      await updateDoc(doc(db, 'users', selectedUser.uid), {
        username: editFormData.username,
        role: editFormData.role
      });

      toast.success('Usuário atualizado com sucesso');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error('Erro ao atualizar usuário: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success('Usuário excluído com sucesso');
      fetchUsers();
    } catch (error: any) {
      toast.error('Erro ao excluir usuário: ' + error.message);
    }
  };

  const openEditModal = (u: UserProfile) => {
    setSelectedUser(u);
    setEditFormData({
      username: u.username || '',
      email: u.email || '',
      role: u.role as any
    });
    setIsEditModalOpen(true);
  };

  const copyToClipboard = () => {
    const textToCopy = showSuccess ? generatedPassword : formData.password;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Senha copiada para a área de transferência');
  };

  const closeAndReset = () => {
    setIsModalOpen(false);
    setShowSuccess(false);
    setGeneratedPassword('');
    setFormData({ username: '', email: '', role: 'company_user', password: '' });
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Gestão de Usuários</h2>
        <button
          onClick={openAddModal}
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
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        {u.uid !== auth.currentUser?.uid && (
                          <button
                            onClick={() => handleDeleteUser(u.uid)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
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
            {showSuccess ? (
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
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Adicionar Novo Usuário</h3>
                  <button onClick={closeAndReset} className="text-gray-500 hover:text-white">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                  Crie um novo acesso para sua empresa. Uma senha provisória já foi gerada abaixo.
                </p>

                <form className="space-y-4" onSubmit={handleAddUser}>
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
                    <label className="block text-sm font-medium text-gray-400">Senha Provisória</label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input
                        type="text"
                        readOnly
                        className="block w-full rounded-lg bg-gray-800 border border-gray-800 pl-10 pr-12 py-3 text-white font-mono focus:outline-none cursor-default"
                        value={formData.password}
                      />
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white transition-colors"
                        title="Copiar senha"
                      >
                        {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 italic">Esta senha será usada para o primeiro login.</p>
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

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Editar Usuário</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleEditUser}>
              <div>
                <label className="block text-sm font-medium text-gray-400">Nome de Usuário (Login)</label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="text"
                    required
                    className="block w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                    value={editFormData.username}
                    onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400">E-mail</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500/50" size={18} />
                  <input
                    type="email"
                    disabled
                    className="block w-full rounded-lg bg-gray-800 border border-gray-800 pl-10 pr-4 py-3 text-gray-500 cursor-not-allowed"
                    value={editFormData.email}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 italic">O e-mail de autenticação não pode ser alterado.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400">Função</label>
                <select
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                >
                  <option value="company_user">Usuário Comum</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="mt-8 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 rounded-lg border border-gray-800 px-4 py-3 text-sm font-semibold text-gray-400 hover:bg-gray-900 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
