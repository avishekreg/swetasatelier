import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserService } from '../services/storeService';
import { UserProfile, UserRole } from '../types';
import {
  CUSTOMER_ROLE,
  canAccessDashboard,
  canAccessAccounts,
  canAccessInventory,
  canAccessOrders,
  canAccessPromotions,
  canManageStaff,
  isPrivilegedRole,
} from '../lib/auth';

/** App-facing auth user (uid mirrors legacy Firebase shape). */
export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

function toAuthUser(user: SupabaseUser | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: (user.user_metadata?.full_name as string | undefined) || null,
  };
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canAccessDashboard: boolean;
  canAccessAccounts: boolean;
  canAccessInventory: boolean;
  canAccessOrders: boolean;
  canAccessPromotions: boolean;
  canManageStaff: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function loadProfileForUser(user: SupabaseUser): Promise<UserProfile> {
  let profile = await UserService.getProfile(user.id);

  if (!profile) {
    const newProfile: Omit<UserProfile, 'createdAt'> = {
      uid: user.id,
      email: user.email || '',
      role: CUSTOMER_ROLE,
      favorites: [],
    };
    await UserService.syncProfile(newProfile);
    profile = { ...newProfile, createdAt: new Date() } as UserProfile;
  }

  return profile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = async (session: Session | null) => {
    const authUser = toAuthUser(session?.user ?? null);
    setUser(authUser);

    if (session?.user) {
      try {
        const p = await loadProfileForUser(session.user);
        setProfile(p);
      } catch (err) {
        console.error(err);
        setProfile(null);
      }
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setLoading(true);
      await applySession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        setLoading(true);
        await applySession(session);
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const p = await loadProfileForUser(data.user);
      setProfile(p);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/login',
      },
    });
    if (error) throw error;
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const role = profile?.role ?? null;

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      isAdmin: isPrivilegedRole(role),
      isSuperAdmin: role === 'super_admin',
      canAccessDashboard: canAccessDashboard(role),
      canAccessAccounts: canAccessAccounts(role),
      canAccessInventory: canAccessInventory(role),
      canAccessOrders: canAccessOrders(role),
      canAccessPromotions: canAccessPromotions(role),
      canManageStaff: canManageStaff(role),
      loading,
      signInWithGoogle,
      signInWithEmailPassword,
      resetPassword,
      signOut,
      refreshProfile,
    }),
    [user, profile, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
