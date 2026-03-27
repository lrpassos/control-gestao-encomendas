import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Shipment, Customer, Distributor, Company } from '../types';
import { BarChart3, Filter, Download, Calendar, User, Truck, Users as UsersIcon, Building2 } from 'lucide-react';
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
  const [statusFilter, setStatusFilter] = useState<'in-stock' | 'withdrawn'>('in-stock');

  // Admin filters
  const [companies, setCompanies] = useState<Company[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(user.companyId);
  const [selectedUserId, setSelectedUserId] = useState(user.role === 'admin' ? 'all' : user.uid);

  const isSuperAdmin = user.email === 'luiz.rogerios@gmail.com';

  const fetchFilters = async () => {
    if (user.role !== 'admin') return;
    try {
      if (isSuperAdmin && companies.length === 0) {
        const companiesSnap = await getDocs(collection(db, 'companies'));
        setCompanies(companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Company)));
      }

      const usersQ = query(collection(db, 'users'), where('companyId', '==', selectedCompanyId));
      const usersSnap = await getDocs(usersQ);
      setUsersList(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() as any } as UserProfile)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'filters');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let shipmentsQ;
      let customersQ;

      if (user.role === 'admin') {
        shipmentsQ = query(
          collection(db, 'shipments'), 
          where('companyId', '==', selectedCompanyId),
          orderBy('createdAt', 'asc')
        );
        customersQ = query(
          collection(db, 'customers'), 
          where('companyId', '==', selectedCompanyId)
        );
      } else {
        shipmentsQ = query(
          collection(db, 'shipments'), 
          where('companyId', '==', user.companyId),
          where('createdBy', '==', user.uid),
          orderBy('createdAt', 'asc')
        );
        customersQ = query(
          collection(db, 'customers'), 
          where('companyId', '==', user.companyId),
          where('createdBy', '==', user.uid)
        );
      }
      const distributorsQ = query(collection(db, 'distributors'), where('companyId', '==', selectedCompanyId));

      const [shipmentsSnap, customersSnap, distributorsSnap] = await Promise.all([
        getDocs(shipmentsQ),
        getDocs(customersQ),
        getDocs(distributorsQ)
      ]);

      let shipmentsList = shipmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Shipment));
      let customersList = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Customer));

      if (user.role === 'admin' && selectedUserId !== 'all') {
        shipmentsList = shipmentsList.filter(s => s.createdBy === selectedUserId);
        customersList = customersList.filter(c => c.createdBy === selectedUserId);
      }

      setShipments(shipmentsList);
      setCustomers(customersList);
      setDistributors(distributorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Distributor)));
    } catch (error: any) {
      handleFirestoreError(error, OperationType.LIST, 'reports/data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchData();
  }, [selectedCompanyId, selectedUserId, user.companyId]);

  const filteredShipments = shipments.filter(s => {
    const matchesCustomer = !customerFilter || s.customerId === customerFilter;
    const matchesDistributor = !distributorFilter || s.distributorId === distributorFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const dateToCompare = statusFilter === 'in-stock' ? s.createdAt : (s.withdrawnAt || s.createdAt);
      const shipmentDate = new Date(dateToCompare);
      matchesDate = format(shipmentDate, 'yyyy-MM-dd') === dateFilter;
    }

    return matchesCustomer && matchesDistributor && matchesDate && s.status === statusFilter;
  });

  const exportToCSV = () => {
    if (filteredShipments.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    const headers = statusFilter === 'in-stock' 
      ? ['Código de Rastreio', 'Cliente', 'Distribuidor', 'Quantidade', 'Data de Entrada', 'Dias em Estoque']
      : ['Código de Rastreio', 'Cliente', 'Distribuidor', 'Quantidade', 'Data de Saída', 'Recebedor', 'CPF'];

    const csvRows = filteredShipments.map(s => {
      const customerName = customers.find(c => c.id === s.customerId)?.name || 'Desconhecido';
      const distributorName = distributors.find(d => d.id === s.distributorId)?.name || 'Desconhecido';
      const displayDate = format(new Date(statusFilter === 'in-stock' ? s.createdAt : (s.withdrawnAt || s.createdAt)), 'dd/MM/yyyy HH:mm');
      
      if (statusFilter === 'in-stock') {
        const daysInStock = Math.floor((new Date().getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return [s.trackingCode, customerName, distributorName, s.quantity, displayDate, daysInStock];
      } else {
        return [s.trackingCode, customerName, distributorName, s.quantity, displayDate, s.receiverName || '-', s.receiverCpf || '-'];
      }
    });

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_${statusFilter}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório exportado com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <h2 className="text-2xl font-bold text-white">Relatórios de Entradas e Saídas</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 rounded-lg border border-gray-800 px-4 py-2 text-sm font-semibold text-gray-400 hover:bg-gray-900 hover:text-white transition-all"
          >
            <Download size={18} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Status Toggle */}
      <div className="flex p-1 bg-[#111] border border-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setStatusFilter('in-stock')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-semibold transition-all",
            statusFilter === 'in-stock' 
              ? "bg-white text-black shadow-lg" 
              : "text-gray-500 hover:text-white"
          )}
        >
          Entradas (Em Estoque)
        </button>
        <button
          onClick={() => setStatusFilter('withdrawn')}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-semibold transition-all",
            statusFilter === 'withdrawn' 
              ? "bg-white text-black shadow-lg" 
              : "text-gray-500 hover:text-white"
          )}
        >
          Saídas (Retirados)
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 rounded-xl bg-[#111] border border-gray-800 p-6 md:grid-cols-4">
        {user.role === 'admin' && (
          <>
            {isSuperAdmin && companies.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Filtrar por Empresa</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                  <select
                    className="w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                    value={selectedCompanyId}
                    onChange={(e) => {
                      setSelectedCompanyId(e.target.value);
                      setSelectedUserId('all');
                    }}
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Filtrar por Usuário</label>
              <div className="relative">
                <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                <select
                  className="w-full rounded-lg bg-gray-900 border border-gray-800 pl-10 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 transition-all"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="all">Todos os Usuários</option>
                  {usersList.map(u => (
                    <option key={u.uid} value={u.uid}>{u.username || u.email}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
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
          <h3 className="font-semibold text-white">
            {statusFilter === 'in-stock' ? 'Remessas Atualmente em Estoque' : 'Remessas Retiradas (Saídas)'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {statusFilter === 'in-stock' 
              ? 'Ordenado por data de entrada (mais antigo para o mais novo)' 
              : 'Ordenado por data de saída'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#161616] text-gray-400 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">Código de Rastreio</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Distribuidor</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">
                  {statusFilter === 'in-stock' ? 'Data de Entrada' : 'Data de Saída'}
                </th>
                {statusFilter === 'withdrawn' && (
                  <>
                    <th className="px-6 py-4">Recebedor</th>
                    <th className="px-6 py-4">CPF</th>
                  </>
                )}
                <th className="px-6 py-4">
                  {statusFilter === 'in-stock' ? 'Dias em Estoque' : 'Status'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={statusFilter === 'withdrawn' ? 8 : 6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={statusFilter === 'withdrawn' ? 8 : 6} className="px-6 py-12 text-center text-gray-500">
                    {statusFilter === 'in-stock' 
                      ? 'Nenhuma remessa em estoque encontrada para os filtros selecionados.' 
                      : 'Nenhuma remessa retirada encontrada para os filtros selecionados.'}
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => {
                  const daysInStock = Math.floor((new Date().getTime() - new Date(shipment.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  const displayDate = statusFilter === 'in-stock' 
                    ? shipment.createdAt 
                    : (shipment.withdrawnAt || shipment.createdAt);

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
                        {format(new Date(displayDate), 'dd/MM/yyyy HH:mm')}
                      </td>
                      {statusFilter === 'withdrawn' && (
                        <>
                          <td className="px-6 py-4 text-gray-300">{shipment.receiverName || '-'}</td>
                          <td className="px-6 py-4 text-gray-400 font-mono text-xs">{shipment.receiverCpf || '-'}</td>
                        </>
                      )}
                      <td className="px-6 py-4">
                        {statusFilter === 'in-stock' ? (
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            daysInStock > 7 ? "bg-red-900/20 text-red-400" : "bg-green-900/20 text-green-400"
                          )}>
                            {daysInStock} {daysInStock === 1 ? 'dia' : 'dias'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-900/20 text-blue-400">
                            Retirado
                          </span>
                        )}
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
