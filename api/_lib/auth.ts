import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type UserRole =
  | 'customer'
  | 'super_admin'
  | 'admin'
  | 'promotions'
  | 'order_fulfillment'
  | 'shipping'
  | 'customer_care';

export type AuthedContext = {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  user: User;
  role: UserRole;
  profile: {
    id: string;
    email: string;
    role: UserRole;
    disabled: boolean;
  };
};

export function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body);
}

export function getBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function getAnonClient(token?: string | null) {
  const urlRaw = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const url = urlRaw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY environment variables.');
  }

  return createClient(url, anon, {
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getServiceClient() {
  const urlRaw = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const url = urlRaw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireUser(req: VercelRequest): Promise<AuthedContext> {
  const token = getBearerToken(req);
  if (!token) {
    throw Object.assign(new Error('Missing Authorization bearer token.'), { statusCode: 401 });
  }

  const supabase = getAnonClient(token);
  const admin = getServiceClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw Object.assign(new Error('Invalid or expired session.'), { statusCode: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, email, role, disabled')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw Object.assign(new Error('User profile not found.'), { statusCode: 403 });
  }

  if (profile.disabled) {
    throw Object.assign(new Error('This account has been disabled.'), { statusCode: 403 });
  }

  return {
    supabase,
    admin,
    user,
    role: profile.role as UserRole,
    profile: profile as AuthedContext['profile'],
  };
}

export function readJsonBody<T extends Record<string, unknown>>(req: VercelRequest): T {
  if (!req.body) return {} as T;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      return {} as T;
    }
  }
  return req.body as T;
}
