#!/usr/bin/env node
/**
 * Seeds demo Auth users + public.users roles in Supabase.
 * Usage: npm run seed:demo-users
 */
import { createClient } from '@supabase/supabase-js';

function normalizeUrl(raw) {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  try {
    const u = new URL(trimmed);
    // Project URL must be origin only (not /rest/v1)
    return `${u.protocol}//${u.host}`;
  } catch {
    return trimmed.replace(/\/rest\/v1\/?$/i, '');
  }
}

const url = normalizeUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

if (!url.includes('supabase.co') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
  console.error('VITE_SUPABASE_URL does not look like a Supabase API URL:', url.replace(/^(https?:\/\/[^/]+).*/, '$1/...'));
  process.exit(1);
}

const DEMO_PASSWORD = 'AtelierDemo2026!';

const demos = [
  { email: 'superadmin@swetasatelier.demo', role: 'super_admin', name: 'Super Admin' },
  { email: 'admin@swetasatelier.demo', role: 'admin', name: 'Boutique Admin' },
  { email: 'fulfillment@swetasatelier.demo', role: 'order_fulfillment', name: 'Order Fulfillment' },
  { email: 'shipping@swetasatelier.demo', role: 'shipping', name: 'Shipping' },
  { email: 'care@swetasatelier.demo', role: 'customer_care', name: 'Customer Care' },
  { email: 'promotions@swetasatelier.demo', role: 'promotions', name: 'Promotions' },
  { email: 'customer@swetasatelier.demo', role: 'customer', name: 'Demo Customer' },
];

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findProfileIdByEmail(email) {
  const { data, error } = await admin.from('users').select('id, email').eq('email', email).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function upsertDemoUser({ email, role, name }) {
  let userId = await findProfileIdByEmail(email);

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name, demo: true },
    });

    if (error) {
      // Already exists in Auth but not in public.users — recover via list filter
      if (/already|registered|exists/i.test(error.message || '')) {
        const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (listed.error) throw listed.error;
        const found = listed.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!found) throw error;
        userId = found.id;
      } else {
        throw error;
      }
    } else {
      userId = data.user.id;
    }
  }

  const { error: updateAuthError } = await admin.auth.admin.updateUserById(userId, {
    password: DEMO_PASSWORD,
    email_confirm: true,
    ban_duration: 'none',
    user_metadata: { full_name: name, demo: true },
  });
  if (updateAuthError) throw updateAuthError;

  const { error: profileError } = await admin.from('users').upsert({
    id: userId,
    email,
    role,
    disabled: false,
  });
  if (profileError) throw profileError;

  return { email, role, password: DEMO_PASSWORD, id: userId };
}

console.log('Seeding against', url.replace(/^(https?:\/\/[^./]+\.supabase\.co).*/, '$1'));

const results = [];
for (const demo of demos) {
  try {
    const row = await upsertDemoUser(demo);
    results.push({ ...row, ok: true });
    console.log(`OK  ${demo.role.padEnd(20)} ${demo.email}`);
  } catch (err) {
    results.push({ email: demo.email, role: demo.role, ok: false, error: String(err?.message || err) });
    console.error(`FAIL ${demo.email}:`, err?.message || err);
  }
}

const ok = results.filter((x) => x.ok);
console.log(`\nCreated/updated ${ok.length}/${demos.length} demo users.`);
if (ok.length) {
  console.log(`Shared password: ${DEMO_PASSWORD}`);
}
if (ok.length < demos.length) {
  process.exitCode = 1;
}
