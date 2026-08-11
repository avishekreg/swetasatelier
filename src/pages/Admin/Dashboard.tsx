import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, DollarSign, Package, ShieldCheck, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ItemService, OrderService } from '../../services/storeService';
import { FashionItem, Order } from '../../types';
import AdminAccessNotice from '../../components/AdminAccessNotice';
import AdminShell from '../../components/AdminShell';

const chartData = [
  { name: 'Mon', sales: 4000 },
  { name: 'Tue', sales: 3000 },
  { name: 'Wed', sales: 2000 },
  { name: 'Thu', sales: 2780 },
  { name: 'Fri', sales: 1890 },
  { name: 'Sat', sales: 2390 },
  { name: 'Sun', sales: 3490 },
];

const seedData = [
  {
    name: 'Emerald Silk Anarkali',
    description: 'A luxurious deep green silk anarkali with intricate gold zardosi work and hand-carved buttons.',
    price: 18500,
    category: 'Suit',
    fabricImageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?auto=format&fit=crop&q=80&w=1200',
    renderedImageUrl: 'https://images.unsplash.com/photo-1594463750939-ebb6d2a40fb?auto=format&fit=crop&q=80&w=1200',
    stock: 5,
    isOneOfOne: false,
    styles: ['Anarkali', 'Long Suit'],
  },
  {
    name: 'Midnight Velvet Lehenga',
    description: 'Rich velvet lehenga in royal blue featuring hand-embroidered floral motifs and a sheer organza dupatta.',
    price: 45000,
    category: 'Lehenga',
    fabricImageUrl: 'https://images.unsplash.com/photo-1589243023531-1e969d7a224f?auto=format&fit=crop&q=80&w=1200',
    renderedImageUrl: 'https://images.unsplash.com/photo-1585487000160-0672e811c009?auto=format&fit=crop&q=80&w=1200',
    stock: 3,
    isOneOfOne: false,
    styles: ['Heavy Lehenga'],
  },
];

const StatCard = ({ title, value, icon: Icon, trend, color }: { title: string; value: string | number; icon: React.ElementType; trend: number; color: string; }) => (
  <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
    <div className="flex justify-between items-start">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div className={`flex items-center text-[10px] uppercase font-bold ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
        {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(trend)}%
      </div>
    </div>
    <div>
      <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">{title}</p>
      <h3 className="text-3xl font-serif mt-1">{value}</h3>
    </div>
  </div>
);

const AdminDashboard = () => {
  const { canAccessDashboard, canManageStaff, isSuperAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<FashionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [allOrders, allItems] = await Promise.all([OrderService.getAllOrders(), ItemService.getAllItems()]);
      setOrders(allOrders ?? []);
      setItems(allItems ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the executive overview right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const totalRevenue = useMemo(() => orders.reduce((acc, curr) => acc + curr.totalAmount, 0), [orders]);

  const seedAtelier = async () => {
    setSeeding(true);
    setError('');
    try {
      for (const item of seedData) {
        await ItemService.addItem(item);
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to seed the sample designs.');
    } finally {
      setSeeding(false);
    }
  };

  if (!canAccessDashboard) return <AdminAccessNotice />;
  if (loading) return <div className="h-screen flex items-center justify-center font-serif italic">Analyzing Business Data...</div>;

  return (
    <AdminShell
      title={<><span>Executive </span><span className="italic">Overview</span></>}
      subtitle="Sweta's Atelier · May 2026 analytics"
      actions={
        <>
          <button
            type="button"
            onClick={() => void seedAtelier()}
            disabled={seeding}
            className="border border-black/10 px-4 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black disabled:opacity-50"
          >
            {seeding ? 'Seeding...' : 'Seed Sample Designs'}
          </button>
          <Link to="/admin/inventory" className="border border-black px-6 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-black hover:text-white transition-all">Manage Inventory</Link>
          <Link to="/admin/accounts" className="border border-black px-6 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-black hover:text-white transition-all">Open Accounts</Link>
          <Link to="/admin/promotions" className="border border-[#D4AF37] text-[#D4AF37] px-6 py-3 text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-[#D4AF37] hover:text-white transition-all">Sales & Offers</Link>
          <Link to="/admin/orders" className="bg-black text-white px-6 py-3 text-[10px] uppercase tracking-[0.3em] font-bold">Process Orders</Link>
        </>
      }
    >
      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={DollarSign} trend={12.5} color="bg-black" />
        <StatCard title="Total Orders" value={orders.length} icon={ShoppingCart} trend={5.2} color="bg-[#D4AF37]" />
        <StatCard title="Active Designs" value={items.length} icon={Package} trend={-2.1} color="bg-[#5A5A40]" />
        <StatCard title="Growth Rate" value="18.4%" icon={TrendingUp} trend={8.1} color="bg-[#D4AF37]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
        <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-8">
          <h3 className="text-sm uppercase tracking-widest font-bold opacity-60">Sales Performance</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="sales" stroke="#D4AF37" fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-5">
            <h3 className="text-sm uppercase tracking-widest font-bold opacity-60">Recent Orders</h3>
            <div className="space-y-4">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between py-3 border-b border-black/5 last:border-0">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-[0.3em]">Order #{order.id.slice(-6)}</p>
                    <p className="text-[11px] opacity-45 mt-1">{order.items.length} items • {order.status}</p>
                  </div>
                  <p className="font-serif">₹{order.totalAmount.toLocaleString()}</p>
                </div>
              ))}
              {orders.length === 0 && <p className="text-center py-12 opacity-30 text-xs italic">No orders yet.</p>}
            </div>
          </div>

          {canManageStaff && (
            <div className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm uppercase tracking-widest font-bold opacity-60">Access Control</h3>
                  <p className="text-sm opacity-60 mt-3">
                    {isSuperAdmin
                      ? 'You are in the recovery lane. Reset admin passwords, rotate staff roles, and keep the client account healthy from one place.'
                      : 'Create limited team logins for shipping, customer care, promotions, and order fulfillment without exposing full admin recovery controls.'}
                  </p>
                </div>
                {isSuperAdmin ? <ShieldCheck className="text-[#D4AF37]" /> : <Users className="text-[#D4AF37]" />}
              </div>
              <Link to="/admin/staff" className="inline-flex items-center gap-2 bg-black text-white px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold">
                {isSuperAdmin ? 'Open Super Admin Console' : 'Open Team Access'}
              </Link>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminDashboard;
