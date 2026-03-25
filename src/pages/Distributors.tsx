import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Distributor } from '../types';
import { Plus, Trash2, Search, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface DistributorsProps {
  user: UserProfile;
}

export default function Distributors({ user }: DistributorsProps) {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchDistributors = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'distributors'), where('companyId', '==', user.companyId));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Distributor));
      setDistributors(list);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.LIST, 'distributors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributors();
  }, [user.companyId]);

  const handleAddDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'distributors'), {
        name: newName,
        companyId: user.companyId
      });
      toast.success('Distribuidor adicionado com sucesso');
      setNewName('');
      setIsAdding(false);
      fetchDistributors();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'distributors');
    }
  };

  const handleDeleteDistributor = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este distribuidor?')) return;
    try {
      await deleteDoc(doc(db, 'distributors', id));
      toast.success('Distribuidor excluído com sucesso');
      fetchDistributors();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'distributors/' + id);
    }
  };

  const filteredDistributors = distributors.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <h2 className="text-2xl font-bold text-white">Distribuidores</h2>
        <div className="flex items-center space-x-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Buscar distribuidores..."
              className="w-full rounded-lg bg-[#111] border border-gray-800 pl-10 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 transition-all"
          >
            <Plus size={18} />
            <span>Adicionar Distribuidor</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-white"></div>
          </div>
        ) : filteredDistributors.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            Nenhum distribuidor encontrado.
          </div>
        ) : (
          filteredDistributors.map((distributor) => (
            <div key={distributor.id} className="group relative rounded-2xl bg-[#111] border border-gray-800 p-6 hover:border-gray-700 transition-all">
              <button
                onClick={() => handleDeleteDistributor(distributor.id)}
                className="absolute right-4 top-4 rounded-lg p-2 text-gray-500 hover:bg-red-900/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={18} />
              </button>
              
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-xl font-bold text-white">
                  <Truck size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white">{distributor.name}</h3>
                  <p className="text-sm text-gray-500">Distribuidor Ativo</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
            <h3 className="text-xl font-bold text-white">Adicionar Novo Distribuidor</h3>
            <p className="mt-2 text-sm text-gray-400">Exemplos: Shopee, Mercado Livre, Amazon</p>
            
            <form className="mt-6 space-y-4" onSubmit={handleAddDistributor}>
              <div>
                <label className="block text-sm font-medium text-gray-400">Nome do Distribuidor</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="mt-8 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 rounded-lg border border-gray-800 px-4 py-3 text-sm font-semibold text-gray-400 hover:bg-gray-900 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 transition-all"
                >
                  Salvar Distribuidor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
