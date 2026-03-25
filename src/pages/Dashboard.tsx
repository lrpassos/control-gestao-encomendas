import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Shipment, Customer, Distributor, Company } from '../types';
import { Search, Package, CheckCircle2, AlertCircle, Calendar, User, Hash, TrendingUp, ArrowUpRight, ArrowDownRight, Filter, Building2, Users as UsersIcon } from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [allShipments, setAllShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [distributors, setDistributors] = useState<Record<string, Distributor>>({});
  const [loading, setLoading] = useState(true);
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalData, setWithdrawalData] = useState({ receiverName: '', receiverCpf: '' });

  // Admin filters
  const [companies, setCompanies] = useState<Company[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(user.companyId);
  const [selectedUserId, setSelectedUserId] = useState(user.role === 'admin' ? 'all' : user.uid);

  const isSuperAdmin = user.email === 'luiz.rogerios@gmail.com';

  const fetchFilters = async () => {
    if (user.role !== 'admin') return;

    try {
      if (isSuperAdmin) {
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
      // Build queries based on role and filters
      let shipmentsQ;
      let customersQ;
      let distributorsQ;

      if (user.role === 'admin') {
        // Admin can see all data for the selected company
        const baseShipmentsQ = query(
          collection(db, 'shipments'),
          where('companyId', '==', selectedCompanyId),
          orderBy('createdAt', 'desc')
        );
        shipmentsQ = baseShipmentsQ;

        const baseCustomersQ = query(
          collection(db, 'customers'),
          where('companyId', '==', selectedCompanyId)
        );
        customersQ = baseCustomersQ;

        distributorsQ = query(collection(db, 'distributors'), where('companyId', '==', selectedCompanyId));
      } else {
        // Regular user only sees their own data
        shipmentsQ = query(
          collection(db, 'shipments'),
          where('companyId', '==', user.companyId),
          where('createdBy', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        customersQ = query(
          collection(db, 'customers'), 
          where('companyId', '==', user.companyId),
          where('createdBy', '==', user.uid)
        );
        distributorsQ = query(collection(db, 'distributors'), where('companyId', '==', user.companyId));
      }

      const [shipmentsSnap, customersSnap, distributorsSnap] = await Promise.all([
        getDocs(shipmentsQ),
        getDocs(customersQ),
        getDocs(distributorsQ)
      ]);

      let allShipmentsList = shipmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any } as Shipment));
      
      // Client-side user filtering for admin if "all" is not selected
      if (user.role === 'admin' && selectedUserId !== 'all') {
        allShipmentsList = allShipmentsList.filter(s => s.createdBy === selectedUserId);
      }

      setAllShipments(allShipmentsList);
      setShipments(allShipmentsList.filter(s => s.status === 'in-stock'));

      const customersMap: Record<string, Customer> = {};
      customersSnap.docs.forEach(doc => { 
        const data = { id: doc.id, ...doc.data() as any } as Customer;
        // Filter customers client-side if admin selected a specific user
        if (user.role !== 'admin' || selectedUserId === 'all' || data.createdBy === selectedUserId) {
          customersMap[doc.id] = data;
        }
      });
      setCustomers(customersMap);

      const distributorsMap: Record<string, Distributor> = {};
      distributorsSnap.docs.forEach(doc => { distributorsMap[doc.id] = { id: doc.id, ...doc.data() as any } as Distributor; });
      setDistributors(distributorsMap);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.LIST, 'dashboard_data');
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

  // Chart data processing
  const chartData = useMemo(() => {
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    });

    return last7Days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const displayDate = format(day, 'dd/MM');

      const entries = allShipments.filter(s => 
        format(new Date(s.createdAt), 'yyyy-MM-dd') === dateStr
      ).reduce((acc, curr) => acc + curr.quantity, 0);

      const exits = allShipments.filter(s => 
        s.status === 'withdrawn' && 
        s.withdrawnAt && 
        format(new Date(s.withdrawnAt), 'yyyy-MM-dd') === dateStr
      ).reduce((acc, curr) => acc + curr.quantity, 0);

      return {
        name: displayDate,
        entradas: entries,
        saidas: exits
      };
    });
  }, [allShipments]);

  const stats = useMemo(() => {
    const inStock = allShipments.filter(s => s.status === 'in-stock').length;
    const totalEntries = allShipments.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalExits = allShipments.filter(s => s.status === 'withdrawn').reduce((acc, curr) => acc + curr.quantity, 0);
    
    return { inStock, totalEntries, totalExits };
  }, [allShipments]);

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
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-x-4 md:space-y-0">
          {user.role === 'admin' && (
            <div className="flex items-center space-x-2">
              {isSuperAdmin && companies.length > 0 && (
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <select
                    className="rounded-lg bg-[#111] border border-gray-800 pl-9 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none transition-all appearance-none"
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
              )}
              <div className="relative">
                <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <select
                  className="rounded-lg bg-[#111] border border-gray-800 pl-9 pr-4 py-2 text-sm text-white focus:border-gray-600 focus:outline-none transition-all appearance-none"
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
          )}
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-[#111] border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <Package className="text-gray-400" size={24} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Em Estoque</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{stats.inStock}</p>
        </div>
        <div className="rounded-xl bg-[#111] border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <ArrowUpRight className="text-green-500" size={24} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Entradas</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{stats.totalEntries}</p>
        </div>
        <div className="rounded-xl bg-[#111] border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <ArrowDownRight className="text-blue-500" size={24} />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Saídas</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{stats.totalExits}</p>
        </div>
      </div>

      {/* Flow Chart */}
      <div className="rounded-xl bg-[#111] border border-gray-800 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-gray-400" />
              Fluxo de Movimentação
            </h3>
            <p className="text-sm text-gray-500">Entradas e saídas nos últimos 7 dias</p>
          </div>
        </div>
        
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#666" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="#666" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#111', 
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Area 
                type="monotone" 
                dataKey="entradas" 
                stroke="#22c55e" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorEntradas)" 
                name="Entradas"
              />
              <Area 
                type="monotone" 
                dataKey="saidas" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorSaidas)" 
                name="Saídas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Shipments List */}
      <div className="rounded-xl bg-[#111] border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-800 p-4 bg-[#161616]">
          <h3 className="font-semibold text-white">Remessas Atuais (Em Estoque)</h3>
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

      {/* Withdrawal Modal */}
      {isWithdrawing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#111] p-8 shadow-2xl border border-gray-800">
            <h3 className="text-xl font-bold text-white">Retirada de Remessa</h3>
            <p className="mt-2 text-sm text-gray-400">
              Forneça os detalhes do recebedor para as {selectedShipments.length} remessas selecionadas.
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
                  Confirmar Retirada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
