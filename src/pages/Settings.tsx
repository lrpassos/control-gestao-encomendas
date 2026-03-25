import React, { useState } from 'react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../firebase';
import { toast } from 'sonner';
import { Lock, ShieldCheck, KeyRound } from 'lucide-react';
import { UserProfile } from '../types';

interface SettingsProps {
  user: UserProfile;
}

export default function Settings({ user }: SettingsProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('As novas senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('Nenhum usuário logado');

      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      await updatePassword(currentUser, newPassword);
      
      toast.success('Senha atualizada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao atualizar a senha. Verifique sua senha atual.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-gray-800 rounded-xl">
          <Lock className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Configurações de Segurança</h2>
          <p className="text-gray-400 text-sm">Gerencie a senha da sua conta e preferências de segurança.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#111] border border-gray-800 p-8 shadow-xl">
        <div className="flex items-center space-x-2 mb-6 text-gray-300 font-semibold">
          <KeyRound size={20} />
          <h3>Alterar Senha</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Senha Atual</label>
            <input
              type="password"
              required
              className="w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Nova Senha</label>
              <input
                type="password"
                required
                className="w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                className="w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center space-x-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Atualizar Senha</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-gray-900/30 border border-gray-800 p-6">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Requisitos da Senha:</h4>
        <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
          <li>Mínimo de 6 caracteres</li>
          <li>Deve incluir pelo menos um número ou caractere especial (recomendado)</li>
          <li>Evite usar palavras comuns ou informações pessoais</li>
        </ul>
      </div>
    </div>
  );
}
