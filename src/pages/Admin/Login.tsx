import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getPostLoginRoute, ROLE_LABELS } from '../../lib/auth';

const AdminLogin = () => {
  const { signInWithEmailPassword, signInWithGoogle, resetPassword, loading, user, profile, role } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetRoute = useMemo(() => getPostLoginRoute(role), [role]);
  const isSignedIn = !!user;

  useEffect(() => {
    if (!loading && isSignedIn) {
      navigate(targetRoute, { replace: true });
    }
  }, [isSignedIn, loading, navigate, targetRoute]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      await signInWithEmailPassword(email.trim(), password);
      setNotice('Signed in. Loading your workspace...');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
      setNotice('Signed in. Loading your workspace...');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to continue with Google.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter the internal team email first, then use password reset.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setNotice('Password reset email sent. Check the team inbox.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send reset email.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-4 py-16 lg:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-10 items-start">
        <section className="space-y-6">
          <p className="text-[10px] uppercase tracking-[0.35em] opacity-50">Atelier Sign In</p>
          <h1 className="text-4xl md:text-5xl font-serif leading-tight">One smart login for clients, staff, and super admin.</h1>
          <p className="text-sm leading-relaxed opacity-65 max-w-xl">
            Use a single sign-in entry point. The app reads your assigned role after authentication and routes you to the right destination automatically.
          </p>
          <div className="bg-white border border-black/5 shadow-sm p-6 space-y-3">
            <h2 className="text-sm uppercase tracking-widest font-bold opacity-60">How routing works</h2>
            <p className="text-sm opacity-70">
              Customer accounts land in order tracking. Admin, super admin, and internal operations roles are sent directly to their respective back-office workspaces.
            </p>
            {user && profile && (
              <div className="flex items-start gap-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                <p>
                  Signed in as <strong>{profile.email || user.email}</strong>
                  {role ? <> with the <strong>{ROLE_LABELS[role]}</strong> role.</> : '.'}
                </p>
              </div>
            )}
            {!user && (
              <div className="flex items-start gap-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 p-4">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <p>
                  Internal team accounts use email and password. Customers can continue with Google and will be routed to their order workspace.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-black/5 shadow-sm p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-serif">Login</h2>
            <p className="text-sm opacity-60">Sign in once and we’ll take you to the right dashboard intelligently.</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              disabled={submitting}
              className="w-full border border-black/10 py-4 uppercase text-[10px] tracking-[0.35em] font-bold hover:border-black disabled:opacity-50"
            >
              Continue With Google
            </button>
          </div>

          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.3em] opacity-40">
            <span className="h-px flex-1 bg-black/10" />
            <span>Internal team access</span>
            <span className="h-px flex-1 bg-black/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Email</span>
              <div className="flex items-center gap-3 border border-black/10 px-4 py-3">
                <Mail size={16} className="opacity-40" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent outline-none text-sm" placeholder="team@swetasatelier.com" />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50">Password</span>
              <div className="flex items-center gap-3 border border-black/10 px-4 py-3">
                <KeyRound size={16} className="opacity-40" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent outline-none text-sm" placeholder="Enter your password" />
              </div>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm text-emerald-700">{notice}</p>}

            <div className="space-y-3">
              <button type="submit" disabled={submitting} className="w-full bg-black text-white py-4 uppercase text-[10px] tracking-[0.35em] font-bold disabled:opacity-50">
                {submitting ? 'Signing In...' : 'Email Login'}
              </button>
              <button type="button" onClick={() => void handleReset()} disabled={submitting} className="w-full border border-black/10 py-4 uppercase text-[10px] tracking-[0.35em] font-bold hover:border-black disabled:opacity-50">
                Reset Team Password
              </button>
            </div>
          </form>

          <p className="text-[11px] opacity-45 leading-relaxed">
            Super admin recovery controls stay inside the team access hub. This page now acts as the single front door for every role.
          </p>
          <Link to="/" className="inline-block text-[10px] uppercase tracking-[0.35em] opacity-50 hover:opacity-100">
            Back To Storefront
          </Link>
        </section>
      </div>
    </motion.div>
  );
};

export default AdminLogin;
