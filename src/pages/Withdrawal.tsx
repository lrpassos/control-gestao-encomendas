import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Shipment, Customer, Distributor } from '../types';
import { Search, Package, CheckCircle2, User, Hash, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface WithdrawalProps {
  user: UserProfile;
}

export default function Withdrawal({ user }: WithdrawalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [distributors, setDistributors] = useState<Record<string, Distributor>>({});
  const [loading, setLoading] = useState(true);
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalData, setWithdrawalData] = useState({ receiverName: '', receiverCpf: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      let shipmentsQ = query(
        collection(db, 'shipments'),
        where('companyId', '==', user.companyId),
        where('status', '==', 'in-stock'),
        orderBy('createdAt', 'desc')
      );

      const [shipmentsSnap, customersSnap, distributorsSnap] = await Promise.all([
        getDocs(shipmentsQ),
        getDocs(query(collection(db, 'customers'), where('companyId', '==', user.companyId))),
        getDocs(query(collection(db, 'distributors'), where('companyId', '==', user.companyId)))
      ]);

      const shipmentsList = shipmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Shipment));
      setShipments(shipmentsList);

      const customersMap: Record<string, Customer> = {};
      customersSnap.docs.forEach(doc => { customersMap[doc.id] = { id: doc.id, ...doc.data() as any } as Customer; });
      setCustomers(customersMap);

      const distributorsMap: Record<string, Distributor> = {};
      distributorsSnap.docs.forEach(doc => { distributorsMap[doc.id] = { id: doc.id, ...doc.data() as any } as Distributor; });
      setDistributors(distributorsMap);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.LIST, 'withdrawal_data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.companyId]);

  const filteredShipments = shipments.filter(s => {
    const customer = customers[s.customerId];
    const searchLower = searchTerm.toLowerCase();
    return (
      s.trackingCode.toLowerCase().includes(searchLower) ||
      (customer && customer.name.toLowerCase().includes(searchLower))
    );
  });

  const toggleSelection = (id: string) => {
    setSelectedShipments(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedShipments.length === 0) return;
    if (!withdrawalData.receiverName || !withdrawalData.receiverCpf) {
      toast.error('Por favor, preencha todos os campos de retirada');
      return;
    }

    try {
      const now = new Date().toISOString();
      await Promise.all(selectedShipments.map(id => 
        updateDoc(doc(db, 'shipments', id), {
          status: 'withdrawn',
          withdrawnAt: now,
          receiverName: withdrawalData.receiverName,
          receiverCpf: withdrawalData.receiverCpf
        })
      ));
      toast.success('Remessas retiradas com sucesso');
      setSelectedShipments([]);
      setWithdrawalData({ receiverName: '', receiverCpf: '' });
      setIsWithdrawing(false);
      fetchData();
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, 'shipments');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-white">Retirada de Encomendas</h2>
          <p className="text-sm text-gray-500">Gerencie a saída de mercadorias do estoque</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Buscar por cliente ou código de rastreio..."
            className="w-full rounded-lg bg-[#111] border border-gray-800 pl-10 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl bg-[#111] border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 p-4 bg-[#161616]">
          <h3 className="font-semibold text-white">Remessas em Estoque</h3>
          {selectedShipments.length > 0 && (
            <button
              onClick={() => setIsWithdrawing(true)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 transition-all"
            >
              Retirar Selecionados ({selectedShipments.length})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#161616] text-gray-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-gray-800 bg-gray-900 text-white focus:ring-0"
                    onChange={(e) => {
                      if (e.target.checked) setSelectedShipments(filteredShipments.map(s => s.id));
                      else setSelectedShipments([]);
                    }}
                    checked={selectedShipments.length === filteredShipments.length && filteredShipments.length > 0}
                  />
                </th>
                <th className="px-6 py-4">Código de Rastreio</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Distribuidor</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">Data de Entrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Nenhuma remessa encontrada em estoque.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-[#161616] transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-gray-800 bg-gray-900 text-white focus:ring-0"
                        checked={selectedShipments.includes(shipment.id)}
                        onChange={() => toggleSelection(shipment.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-300">{shipment.trackingCode}</td>
                    <td className="px-6 py-4 text-white font-medium">
                      {customers[shipment.customerId]?.name || 'Desconhecido'}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {distributors[shipment.distributorId]?.name || 'Desconhecido'}
                    </td>
                    <td className="px-6 py-4 text-gray-300">{shipment.quantity}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {format(new Date(shipment.createdAt), 'dd/MM/yyyy HH:mm')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isWithdrawing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
            <h3 className="text-xl font-bold text-white">Confirmar Retirada</h3>
            <p className="mt-2 text-sm text-gray-400">
              Forneça os detalhes do recebedor para as {selectedShipments.length} remessas.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleWithdraw}>
              <div>
                <label className="block text-sm font-medium text-gray-400">Nome do Recebedor</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={withdrawalData.receiverName}
                  onChange={(e) => setWithdrawalData({ ...withdrawalData, receiverName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">CPF do Recebedor</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={withdrawalData.receiverCpf}
                  onChange={(e) => setWithdrawalData({ ...withdrawalData, receiverCpf: e.target.value })}
                />
              </div>

              <div className="mt-8 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsWithdrawing(false)}
                  className="flex-1 rounded-lg border border-gray-800 px-4 py-3 text-sm font-semibold text-gray-400 hover:bg-gray-900 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-gray-200 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
