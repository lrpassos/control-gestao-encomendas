import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Customer } from '../types';
import { Plus, Trash2, Search, User, Phone, MapPin, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface CustomersProps {
  user: UserProfile;
}

export default function Customers({ user }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    email: ''
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'customers'), where('companyId', '==', user.companyId));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(list);
    } catch (error: any) {
      toast.error('Falha ao buscar clientes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [user.companyId]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        companyId: user.companyId
      });
      toast.success('Cliente adicionado com sucesso');
      setNewCustomer({ name: '', phone: '', address: '', email: '' });
      setIsAdding(false);
      fetchCustomers();
    } catch (error: any) {
      toast.error('Falha ao adicionar cliente: ' + error.message);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      toast.success('Cliente excluído com sucesso');
      fetchCustomers();
    } catch (error: any) {
      toast.error('Falha ao excluir cliente: ' + error.message);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <h2 className="text-2xl font-bold text-white">Clientes</h2>
        <div className="flex items-center space-x-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Buscar clientes..."
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
            <span>Adicionar Cliente</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-white"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            Nenhum cliente encontrado.
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div key={customer.id} className="group relative rounded-2xl bg-[#111] border border-gray-800 p-6 hover:border-gray-700 transition-all">
              <button
                onClick={() => handleDeleteCustomer(customer.id)}
                className="absolute right-4 top-4 rounded-lg p-2 text-gray-500 hover:bg-red-900/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={18} />
              </button>
              
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-xl font-bold text-white">
                  {customer.name[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white">{customer.name}</h3>
                  <p className="text-sm text-gray-500">{customer.email}</p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-gray-400">
                <div className="flex items-center space-x-3">
                  <Phone size={16} className="text-gray-600" />
                  <span>{customer.phone || 'Sem telefone'}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin size={16} className="text-gray-600" />
                  <span className="truncate">{customer.address || 'Sem endereço'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
            <h3 className="text-xl font-bold text-white">Adicionar Novo Cliente</h3>
            
            <form className="mt-6 space-y-4" onSubmit={handleAddCustomer}>
              <div>
                <label className="block text-sm font-medium text-gray-400">Nome Completo</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">E-mail</label>
                <input
                  type="email"
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Telefone</label>
                <input
                  type="tel"
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Endereço</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
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
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
