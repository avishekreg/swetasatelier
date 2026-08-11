import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import {
  ROLE_LABELS,
  SUPER_ADMIN_ROLE,
  canAccessAccounts,
  canAccessInventory,
  canAccessOrders,
  canAccessPromotions,
  canManageStaff,
} from '../lib/auth';

interface AdminShellProps {
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const AdminShell: React.FC<AdminShellProps> = ({ title, subtitle, actions, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();

  const navItems = [
    { to: '/admin', label: 'Dashboard', show: true },
    { to: '/admin/accounts', label: 'Accounts', show: canAccessAccounts(role) },
    { to: '/admin/inventory', label: 'Inventory', show: canAccessInventory(role) },
    { to: '/admin/orders', label: 'Orders', show: canAccessOrders(role) },
    { to: '/admin/promotions', label: 'Offers', show: canAccessPromotions(role) },
    { to: '/admin/staff', label: role === SUPER_ADMIN_ROLE ? 'Super Admin' : 'Team Access', show: canManageStaff(role) },
  ].filter((item) => item.show);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-4 py-12 space-y-10">
      <div className="flex flex-col gap-6 border-b border-black/10 pb-8">
        <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.35em] opacity-55">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/admin'))}
            className="inline-flex items-center gap-2 border border-black/10 px-4 py-2 hover:border-black transition-colors"
          >
            <ArrowLeft size={14} />
            Go Back
          </button>
          <Link to="/admin" className="hover:opacity-100 transition-opacity">Admin Dashboard</Link>
          <span className="opacity-20">/</span>
          <span className="opacity-80">Atelier Operations</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#a17f1a] shadow-sm border border-[#d4af37]/30">
                {role === SUPER_ADMIN_ROLE ? <ShieldCheck size={12} /> : <Shield size={12} />}
                {ROLE_LABELS[role ?? 'customer']}
              </span>
              {role === SUPER_ADMIN_ROLE && (
                <span className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white">
                  <Sparkles size={12} />
                  Recovery Controls Enabled
                </span>
              )}
              {canManageStaff(role) && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-black/60 border border-black/10">
                  <Users size={12} />
                  Team Access Hub
                </span>
              )}
            </div>
            <div>
              <h1 className="text-4xl font-serif">{title}</h1>
              <p className="text-[10px] uppercase tracking-widest opacity-50 mt-2">{subtitle}</p>
            </div>
          </div>

          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>

        <div className="flex flex-wrap gap-3">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active
                  ? 'bg-black text-white px-4 py-2 text-[10px] uppercase tracking-[0.3em] font-bold'
                  : 'border border-black/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black'}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </motion.div>
  );
};

export default AdminShell;
