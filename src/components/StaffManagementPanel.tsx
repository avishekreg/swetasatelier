import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, KeyRound, Plus, ShieldCheck, UserCog, UserRoundX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AdminApi } from '../services/adminApi';
import type { StaffAccount, StaffAccountInput, UserRole } from '../types';
import {
  ROLE_LABELS,
  SUPER_ADMIN_ROLE,
  canModifyUserRole,
  canResetManagedAccount,
  getAssignableRoles,
} from '../lib/auth';
import RoleBadge from './RoleBadge';

const emptyForm: StaffAccountInput = {
  email: '',
  password: '',
  role: 'order_fulfillment',
};

const StaffManagementPanel: React.FC = () => {
  const { role, profile } = useAuth();
  const [users, setUsers] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [resetUid, setResetUid] = useState<string | null>(null);
  const [resetPassword, setResetPasswordValue] = useState('');
  const [form, setForm] = useState<StaffAccountInput>(emptyForm);

  const assignableRoles = useMemo(() => getAssignableRoles(role), [role]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await AdminApi.listStaff();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the team access panel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (assignableRoles.length > 0 && !assignableRoles.includes(form.role)) {
      setForm((current) => ({ ...current, role: assignableRoles[0] as StaffAccountInput['role'] }));
    }
  }, [assignableRoles, form.role]);

  const visibleUsers = useMemo(() => users.filter((user) => user.role !== 'customer'), [users]);
  const summary = useMemo(() => {
    const counts = visibleUsers.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] ?? 0) + 1;
      return acc;
    }, {});

    return [
      { label: 'Internal Seats', value: visibleUsers.length },
      { label: 'Admins', value: (counts.admin ?? 0) + (counts.super_admin ?? 0) },
      { label: 'Operations', value: (counts.order_fulfillment ?? 0) + (counts.shipping ?? 0) },
      { label: 'Support & Offers', value: (counts.customer_care ?? 0) + (counts.promotions ?? 0) },
    ];
  }, [visibleUsers]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setGeneratedPassword('');

    try {
      const result = await AdminApi.createStaff(form);
      setMessage(`${result.user.email} is ready with the ${ROLE_LABELS[result.user.role]} role.`);
      setGeneratedPassword(result.credentials.password);
      setForm({ ...emptyForm, role: assignableRoles[0] as StaffAccountInput['role'] });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the staff account.');
    } finally {
      setSaving(false);
    }
  };

  const onUpdateRole = async (uid: string, newRole: UserRole) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await AdminApi.updateRole(uid, newRole);
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change the staff role.');
    } finally {
      setSaving(false);
    }
  };

  const onToggleDisabled = async (uid: string, disabled: boolean) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await AdminApi.setDisabled(uid, disabled);
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the staff account status.');
    } finally {
      setSaving(false);
    }
  };

  const onResetPassword = async (uid: string) => {
    if (!resetPassword.trim()) {
      setError('Enter a new temporary password before applying the reset.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await AdminApi.resetPassword(uid, resetPassword.trim());
      setMessage(result.message);
      setGeneratedPassword(resetPassword.trim());
      setResetUid(null);
      setResetPasswordValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rotate the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summary.map((item) => (
          <div key={item.label} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">{item.label}</p>
            <p className="text-3xl font-serif mt-3">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-8">
        <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Provision Access</p>
            <h2 className="text-2xl font-serif mt-2">Create a staff login</h2>
            <p className="text-sm opacity-60 mt-2">
              {role === SUPER_ADMIN_ROLE
                ? 'Use this to create admins or internal specialists without exposing your recovery login.'
                : 'Use this to create operations, shipping, customer care, or promotions accounts for the boutique team.'}
            </p>
          </div>

          <form onSubmit={onCreate} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Work Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
                placeholder="team@swetasatelier.com"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Temporary Password</span>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37]"
                placeholder="Share this once, then rotate later"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Role</span>
              <select
                value={form.role}
                onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as StaffAccountInput['role'] }))}
                className="w-full border border-black/10 px-4 py-3 outline-none focus:border-[#D4AF37] bg-white"
              >
                {assignableRoles.map((assignableRole) => (
                  <option key={assignableRole} value={assignableRole}>
                    {ROLE_LABELS[assignableRole]}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={saving || !form.email || !form.password}
              className="w-full bg-black text-white py-4 uppercase text-[10px] tracking-[0.35em] font-bold disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2 justify-center">
                <Plus size={14} />
                {saving ? 'Provisioning Access...' : 'Create Staff Login'}
              </span>
            </button>
          </form>

          {generatedPassword && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 space-y-2">
              <p className="font-semibold">Temporary credential ready</p>
              <p>Share this password once, then ask the staff member to change it after first sign-in.</p>
              <code className="block bg-white px-3 py-2 rounded border border-emerald-200 text-black">{generatedPassword}</code>
            </div>
          )}

          {role === SUPER_ADMIN_ROLE && (
            <div className="rounded-2xl border border-black/10 bg-[#f8f4ea] p-4 text-sm leading-relaxed opacity-70">
              <p className="font-semibold">Super admin note</p>
              <p className="mt-2">
                Admin seats can be reset, disabled, or reassigned here. Your own super admin login stays outside day-to-day boutique operations.
              </p>
            </div>
          )}
        </section>

        <section className="bg-white p-8 rounded-2xl border border-black/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Live Access Registry</p>
              <h2 className="text-2xl font-serif mt-2">Team members and recovery controls</h2>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="border border-black/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

          {loading ? (
            <div className="py-20 text-center italic font-serif opacity-40">Loading the access registry...</div>
          ) : (
            <div className="space-y-4">
              {visibleUsers.map((user) => {
                const canEditRole = canModifyUserRole(role, user.role) && user.uid !== profile?.uid;
                const canReset = canResetManagedAccount(role, user.role) && user.uid !== profile?.uid;
                const canDisable = canReset && user.role !== 'super_admin';
                return (
                  <div key={user.uid} className="border border-black/5 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-medium">{user.email}</p>
                          <RoleBadge role={user.role} />
                          {user.disabled && (
                            <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.25em] font-bold bg-red-50 text-red-700 border border-red-100">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-45 mt-2">
                          Created {user.creationTime ? new Date(user.creationTime).toLocaleString() : 'recently'}
                          {user.lastSignInTime ? ` • Last sign-in ${new Date(user.lastSignInTime).toLocaleString()}` : ' • No sign-in yet'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {canEditRole && (
                          <select
                            value={user.role}
                            onChange={(e) => void onUpdateRole(user.uid, e.target.value as UserRole)}
                            className="border border-black/10 px-3 py-2 text-[11px] uppercase tracking-[0.25em] font-bold bg-white"
                          >
                            {[user.role, ...assignableRoles.filter((item) => item !== user.role)].map((option) => (
                              <option key={option} value={option}>
                                {ROLE_LABELS[option]}
                              </option>
                            ))}
                          </select>
                        )}

                        {canDisable && (
                          <button
                            type="button"
                            onClick={() => void onToggleDisabled(user.uid, !user.disabled)}
                            className="border border-black/10 px-4 py-2 text-[10px] uppercase tracking-[0.3em] font-bold hover:border-black"
                          >
                            {user.disabled ? 'Re-enable' : 'Disable'}
                          </button>
                        )}
                      </div>
                    </div>

                    {canReset && (
                      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center bg-[#f8f4ea] rounded-2xl p-4 border border-black/5">
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.3em] opacity-45">Recovery Reset</p>
                          <div className="flex flex-col md:flex-row gap-3">
                            <input
                              type="text"
                              value={resetUid === user.uid ? resetPassword : ''}
                              onChange={(e) => {
                                setResetUid(user.uid);
                                setResetPasswordValue(e.target.value);
                              }}
                              className="flex-1 border border-black/10 px-4 py-3 bg-white outline-none focus:border-[#D4AF37]"
                              placeholder={`Set a fresh temporary password for ${user.email}`}
                            />
                            <button
                              type="button"
                              onClick={() => void onResetPassword(user.uid)}
                              className="bg-black text-white px-5 py-3 text-[10px] uppercase tracking-[0.3em] font-bold"
                            >
                              <span className="inline-flex items-center gap-2">
                                <KeyRound size={14} />
                                Reset Password
                              </span>
                            </button>
                          </div>
                        </div>
                        <div className="text-[11px] opacity-55 leading-relaxed">
                          {user.role === 'admin'
                            ? 'This rotates the client admin password from the secure super admin lane.'
                            : 'Use this when a staff member forgets a temporary password or changes teams.'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleUsers.length === 0 && (
                <div className="py-20 text-center opacity-35 italic font-serif">No internal users have been provisioned yet.</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StaffManagementPanel;
