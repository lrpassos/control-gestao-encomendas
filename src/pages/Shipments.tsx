import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Shipment, Customer, Distributor } from '../types';
import { Plus, Trash2, Search, Package, Hash, User, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ShipmentsProps {
  user: UserProfile;
}

export default function Shipments({ user }: ShipmentsProps) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newShipment, setNewShipment] = useState({
    trackingCode: '',
    quantity: 1,
    distributorId: '',
    customerId: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const shipmentsQ = query(collection(db, 'shipments'), where('companyId', '==', user.companyId));
      const customersQ = query(collection(db, 'customers'), where('companyId', '==', user.companyId));
      const distributorsQ = query(collection(db, 'distributors'), where('companyId', '==', user.companyId));

      const [shipmentsSnap, customersSnap, distributorsSnap] = await Promise.all([
        getDocs(shipmentsQ),
        getDocs(customersQ),
        getDocs(distributorsQ)
      ]);

      setShipments(shipmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shipment)));
      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setDistributors(distributorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Distributor)));
    } catch (error: any) {
      toast.error('Falha ao buscar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.companyId]);

  const handleAddShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipment.customerId || !newShipment.distributorId) {
      toast.error('Por favor, selecione um cliente e um distribuidor');
      return;
    }

    try {
      await addDoc(collection(db, 'shipments'), {
        ...newShipment,
        companyId: user.companyId,
        status: 'in-stock',
        createdAt: new Date().toISOString()
      });
      toast.success('Remessa adicionada com sucesso');
      setNewShipment({ trackingCode: '', quantity: 1, distributorId: '', customerId: '' });
      setIsAdding(false);
      fetchData();
    } catch (error: any) {
      toast.error('Falha ao adicionar remessa: ' + error.message);
    }
  };

  const handleDeleteShipment = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta remessa?')) return;
    try {
      await deleteDoc(doc(db, 'shipments', id));
      toast.success('Remessa excluída com sucesso');
      fetchData();
    } catch (error: any) {
      toast.error('Falha ao excluir remessa: ' + error.message);
    }
  };

  const filteredShipments = shipments.filter(s => 
    s.trackingCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <h2 className="text-2xl font-bold text-white">Remessas</h2>
        <div className="flex items-center space-x-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Buscar código de rastreio..."
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
            <span>Nova Remessa</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-[#111] border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#161616] text-gray-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Código de Rastreio</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Distribuidor</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Nenhuma remessa encontrada.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-[#161616] transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-300">{shipment.trackingCode}</td>
                    <td className="px-6 py-4 text-white font-medium">
                      {customers.find(c => c.id === shipment.customerId)?.name || 'Desconhecido'}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {distributors.find(d => d.id === shipment.distributorId)?.name || 'Desconhecido'}
                    </td>
                    <td className="px-6 py-4 text-gray-300">{shipment.quantity}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        shipment.status === 'in-stock' 
                          ? 'bg-green-900/20 text-green-400' 
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {shipment.status === 'in-stock' ? 'Em Estoque' : 'Retirado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {format(new Date(shipment.createdAt), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteShipment(shipment.id)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-red-900/20 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
            <h3 className="text-xl font-bold text-white">Adicionar Nova Remessa</h3>
            
            <form className="mt-6 space-y-4" onSubmit={handleAddShipment}>
              <div>
                <label className="block text-sm font-medium text-gray-400">Código de Rastreio</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={newShipment.trackingCode}
                  onChange={(e) => setNewShipment({ ...newShipment, trackingCode: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Cliente</label>
                <select
                  required
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={newShipment.customerId}
                  onChange={(e) => setNewShipment({ ...newShipment, customerId: e.target.value })}
                >
                  <option value="">Selecionar Cliente</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400">Distribuidor</label>
                  <select
                    required
                    className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                    value={newShipment.distributorId}
                    onChange={(e) => setNewShipment({ ...newShipment, distributorId: e.target.value })}
                  >
                    <option value="">Selecionar Distribuidor</option>
                    {distributors.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400">Quantidade</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                    value={newShipment.quantity}
                    onChange={(e) => setNewShipment({ ...newShipment, quantity: parseInt(e.target.value) })}
                  />
                </div>
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
                  Salvar Remessa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
