# Sweta's Atelier

Boutique storefront and back-office app built with Vite, React, Supabase, and Vercel.

## Local development

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill values.
3. Start the app:
   `npm run dev` (http://localhost:3000)
4. Verify types:
   `npm run lint`

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase-schema.sql`](supabase-schema.sql) in the SQL Editor (tables, RLS, fabrics storage bucket, accounts seed).
3. Copy the project URL and anon key into `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
4. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to Vite).

## Vercel deployment

Build settings:
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- API routes: `/api/*` (Node serverless)

SPA fallback is configured in [`vercel.json`](vercel.json).

### Required Vercel environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Staff admin + order writes + webhook updates |
| `GEMINI_API_KEY` | Secure AI couture (`/api/ai-couture`) |
| `RAZORPAY_KEY_ID` | Checkout key returned by create-order API |
| `RAZORPAY_KEY_SECRET` | Server-side Razorpay order creation |
| `RAZORPAY_WEBHOOK_SECRET` | Signature verify on `/api/razorpay-webhook` |
| `APP_URL` | Public site URL (optional) |

Point Razorpay webhooks to `https://<your-domain>/api/razorpay-webhook` for `payment.captured`.

## Access model (roles)

- `super_admin`: recovery lane, admin resets, access governance
- `admin`: daily boutique operations and limited staff management
- `order_fulfillment`
- `shipping`
- `customer_care`
- `promotions`
- `customer`

RLS policies in `supabase-schema.sql` align staff order/promo access with these roles.

## Demo users

Seed all role accounts (requires `.env.local` with service role key):

```bash
npm run seed:demo-users
```

Shared demo password: `AtelierDemo2026!`  
Emails: `superadmin@`, `admin@`, `fulfillment@`, `shipping@`, `care@`, `promotions@`, `customer@` + `swetasatelier.demo`

## Auth & data

The app uses **Supabase Auth + Postgres** for login, catalog, orders, accounts, and staff APIs.
