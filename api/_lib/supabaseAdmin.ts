import { getServiceClient } from './auth';

/** Service-role Supabase client for privileged server operations. */
export function supabaseAdmin() {
  return getServiceClient();
}
