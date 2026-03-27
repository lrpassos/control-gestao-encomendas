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
        
        <div className="h-[300px] w-full min-h-[300px] relative">
          {!loading && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  dy={10}
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
          ) : (
            <div className="flex h-full items-center justify-center text-gray-600 border border-dashed border-gray-800 rounded-lg">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
                  <span>Carregando gráfico...</span>
                </div>
              ) : 'Sem dados para exibir nos últimos 7 dias'}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-[#111] border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Atividade Recente</h3>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Últimas 5 Entradas</span>
          </div>
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
              </div>
            ) : shipments.length === 0 ? (
              <p className="text-center text-sm text-gray-600 py-8">Nenhuma atividade recente encontrada.</p>
            ) : (
              shipments.slice(0, 5).map((shipment) => (
                <div key={shipment.id} className="flex items-center justify-between rounded-lg bg-[#161616] p-4 border border-gray-800/50">
                  <div className="flex items-center space-x-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-900/20 text-green-400">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{shipment.trackingCode}</p>
                      <p className="text-xs text-gray-500">
                        {customers[shipment.customerId]?.name || 'Cliente Desconhecido'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-400">
                      {format(new Date(shipment.createdAt), 'HH:mm')}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {format(new Date(shipment.createdAt), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[#111] border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">Status do Sistema</h3>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tempo Real</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-[#161616] p-4 border border-gray-800/50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Conexão</p>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                <p className="text-sm font-medium text-white">Online</p>
              </div>
            </div>
            <div className="rounded-lg bg-[#161616] p-4 border border-gray-800/50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Banco de Dados</p>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <p className="text-sm font-medium text-white">Sincronizado</p>
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 rounded-lg bg-blue-900/10 border border-blue-900/20">
            <p className="text-xs text-blue-400 leading-relaxed">
              O sistema está processando as remessas em tempo real. Todas as alterações são sincronizadas instantaneamente com o servidor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
