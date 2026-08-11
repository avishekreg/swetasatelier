import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'Supabase env vars missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for Phase 1+ APIs.'
  );
}

export const supabase = createClient(url || '', anonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Prefer Supabase session; fall back to Firebase ID token during Phase 1 dual-auth. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    return data.session.access_token;
  }

  try {
    const { auth } = await import('../firebase');
    const user = auth.currentUser;
    if (user) {
      return user.getIdToken(true);
    }
  } catch {
    // Firebase may be unavailable after Phase 2 cutover.
  }

  return null;
}
