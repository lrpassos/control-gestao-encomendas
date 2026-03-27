import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { UserProfile, Company } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  Package, 
  BarChart3, 
  LogOut, 
  Menu, 
  X,
  Settings,
  Building2,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, getDocs } from 'firebase/firestore';

interface LayoutProps {
  user: UserProfile;
  setUser: (user: UserProfile | null) => void;
  onLogout: () => void;
}

export default function Layout({ user, setUser, onLogout }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, 10 * 60 * 1000); // 10 minutes
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimeout));
    resetTimeout();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimeout));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (user.role === 'admin') {
      const fetchCompanies = async () => {
        const querySnapshot = await getDocs(collection(db, 'companies'));
        const comps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
        setCompanies(comps);
      };
      fetchCompanies();
    }
  }, [user.role]);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Remessas', path: '/shipments', icon: Package },
    { name: 'Clientes', path: '/customers', icon: Users },
    { name: 'Retirada', path: '/withdrawal', icon: CheckCircle2 },
    { name: 'Distribuidores', path: '/distributors', icon: Truck },
    { name: 'Usuários', path: '/users', icon: ShieldCheck, adminOnly: true },
    { name: 'Relatórios', path: '/reports', icon: BarChart3 },
    { name: 'Configurações', path: '/settings', icon: Settings },
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || user.role === 'admin');

  const handleCompanyChange = (companyId: string) => {
    setUser({ ...user, companyId });
  };

  return (
    <div className="flex h-screen bg-black text-gray-100">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-[#111] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-6">
            <h1 className="text-xl font-bold tracking-tight text-white">CONTROL</h1>
            <button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-4">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "flex items-center space-x-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-gray-800 text-white" 
                      : "text-gray-400 hover:bg-gray-900 hover:text-white"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {user.role === 'admin' && (
            <div className="border-t border-gray-800 p-4">
              <div className="mb-2 flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Building2 size={14} />
                <span>Trocar Empresa</span>
              </div>
              <select
                className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gray-700"
                value={user.companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-gray-800 p-4">
            <div className="flex items-center space-x-3 px-4 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 font-bold text-white">
                {user.email[0].toUpperCase()}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-white">{user.email}</span>
                <span className="text-xs text-gray-500 capitalize">
                  {user.role === 'admin' ? 'Administrador' : 'Usuário da Empresa'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-800 bg-[#111] px-6">
          <button className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="ml-auto flex items-center space-x-4">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:bg-gray-900 hover:text-white transition-colors"
            >
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
