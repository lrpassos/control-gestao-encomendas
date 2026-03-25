import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Shipment, Customer, Distributor } from '../types';
import { BarChart3, Filter, Download, Calendar, User, Truck } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface ReportsProps {
  user: UserProfile;
}

export default function Reports({ user }: ReportsProps) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [distributorFilter, setDistributorFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all shipments for the company, ordered by date (oldest first as requested)
      const shipmentsQ = query(
        collection(db, 'shipments'), 
        where('companyId', '==', user.companyId),
        orderBy('createdAt', 'asc')
      );
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

  const filteredShipments = shipments.filter(s => {
    const matchesCustomer = !customerFilter || s.customerId === customerFilter;
    const matchesDistributor = !distributorFilter || s.distributorId === distributorFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const shipmentDate = new Date(s.createdAt);
      const filterDate = new Date(dateFilter);
      matchesDate = format(shipmentDate, 'yyyy-MM-dd') === dateFilter;
    }

    return matchesCustomer && matchesDistributor && matchesDate && s.status === 'in-stock';
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <h2 className="text-2xl font-bold text-white">Relatórios de Inventário</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => toast.info('Funcionalidade de exportação em breve!')}
            className="flex items-center space-x-2 rounded-lg border border-gray-800 px-4 py-2 text-sm font-semibold text-gray-400 hover:bg-gray-900 hover:text-white transition-all"
          >
            <Download size={18} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 rounded-xl bg-[#111] border border-gray-800 p-6 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Filtrar por Data</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
            <input
              type="date"
              className="w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Filtrar por Cliente</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
            <select
              className="w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="">Todos os Clientes</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Filtrar por Distribuidor</label>
          <div className="relative">
            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
            <select
              className="w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
              value={distributorFilter}
              onChange={(e) => setDistributorFilter(e.target.value)}
            >
              <option value="">Todos os Distribuidores</option>
              {distributors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="rounded-xl bg-[#111] border border-gray-800 overflow-hidden">
        <div className="border-b border-gray-800 p-4 bg-[#161616]">
          <h3 className="font-semibold text-white">Remessas Atualmente em Estoque</h3>
          <p className="text-xs text-gray-500 mt-1">Ordenado por data (mais antigo para o mais novo)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#161616] text-gray-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Código de Rastreio</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Distribuidor</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">Data de Entrada</th>
                <th className="px-6 py-4">Dias em Estoque</th>
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
                    Nenhuma remessa em estoque encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => {
                  const daysInStock = Math.floor((new Date().getTime() - new Date(shipment.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={shipment.id} className="hover:bg-[#161616] transition-colors">
                      <td className="px-6 py-4 font-mono text-gray-300">{shipment.trackingCode}</td>
                      <td className="px-6 py-4 text-white font-medium">
                        {customers.find(c => c.id === shipment.customerId)?.name || 'Desconhecido'}
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {distributors.find(d => d.id === shipment.distributorId)?.name || 'Desconhecido'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">{shipment.quantity}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {format(new Date(shipment.createdAt), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          daysInStock > 7 ? "bg-red-900/20 text-red-400" : "bg-green-900/20 text-green-400"
                        )}>
                          {daysInStock} {daysInStock === 1 ? 'dia' : 'dias'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
