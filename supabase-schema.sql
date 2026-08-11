-- Sweta's Atelier — Supabase initial schema
-- Run once in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum (
    'customer',
    'super_admin',
    'admin',
    'promotions',
    'order_fulfillment',
    'shipping',
    'customer_care'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.discount_type as enum ('percentage', 'fixed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'processing', 'shipped', 'delivered');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_item_type as enum ('stitched', 'material');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.gst_tax_mode as enum ('intra_state', 'inter_state');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.invoice_payment_status as enum ('unpaid', 'partial', 'paid');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.user_role not null default 'customer',
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) > 0 and char_length(name) < 100),
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  sale_price numeric(12, 2) check (sale_price is null or sale_price >= 0),
  sale_description text,
  category text not null,
  fabric_image_url text not null,
  rendered_image_url text,
  stock integer not null default 0 check (stock >= 0),
  is_one_of_one boolean not null default false,
  styles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  discount_type public.discount_type not null,
  discount_value numeric(12, 2) not null check (discount_value >= 0),
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean not null default true,
  applicable_categories text[] not null default '{}',
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  status public.order_status not null default 'pending',
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  quantity integer not null check (quantity > 0),
  type public.order_item_type not null,
  measurements jsonb not null default '{}'::jsonb,
  unit_price numeric(12, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.user_favorites (
  user_id uuid not null references public.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.accounts_settings (
  id text primary key default 'current' check (id = 'current'),
  legal_name text not null,
  trade_name text not null,
  gstin text not null default '',
  state_code text not null,
  state_name text not null,
  invoice_prefix text not null,
  next_invoice_number integer not null default 1 check (next_invoice_number >= 1),
  financial_year_label text not null,
  default_gst_rate numeric(5, 2) not null default 5
    check (default_gst_rate in (0, 3, 5, 12, 18, 28)),
  default_tax_mode public.gst_tax_mode not null default 'intra_state',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts_entries (
  id uuid primary key default gen_random_uuid(),
  source_order_id uuid references public.orders (id) on delete set null,
  invoice_number text not null,
  invoice_date date not null,
  customer_name text not null,
  customer_email text,
  customer_gstin text,
  place_of_supply text not null,
  item_summary text not null,
  taxable_amount numeric(12, 2) not null check (taxable_amount >= 0),
  gst_rate numeric(5, 2) not null check (gst_rate in (0, 3, 5, 12, 18, 28)),
  tax_mode public.gst_tax_mode not null,
  cgst_amount numeric(12, 2) not null default 0 check (cgst_amount >= 0),
  sgst_amount numeric(12, 2) not null default 0 check (sgst_amount >= 0),
  igst_amount numeric(12, 2) not null default 0 check (igst_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  payment_status public.invoice_payment_status not null default 'unpaid',
  payment_method text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists promotions_created_at_idx on public.promotions (created_at desc);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_razorpay_order_id_idx on public.orders (razorpay_order_id);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists accounts_entries_created_at_idx on public.accounts_entries (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists accounts_settings_set_updated_at on public.accounts_settings;
create trigger accounts_settings_set_updated_at
  before update on public.accounts_settings
  for each row execute function public.set_updated_at();

drop trigger if exists accounts_entries_set_updated_at on public.accounts_entries;
create trigger accounts_entries_set_updated_at
  before update on public.accounts_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth → profile bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, coalesce(new.email, ''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (security definer to avoid recursive policy checks)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('super_admin', 'admin') from public.users where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_staff_orders()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role in (
        'super_admin',
        'admin',
        'order_fulfillment',
        'shipping',
        'customer_care'
      )
      from public.users
      where id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_promotions_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role in ('super_admin', 'admin', 'promotions')
      from public.users
      where id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.can_manage_accounts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_privileged();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.promotions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.user_favorites enable row level security;
alter table public.accounts_settings enable row level security;
alter table public.accounts_entries enable row level security;

-- users
drop policy if exists users_select_own_or_privileged on public.users;
create policy users_select_own_or_privileged on public.users
  for select using (id = auth.uid() or public.is_privileged());

drop policy if exists users_update_own_or_privileged on public.users;
create policy users_update_own_or_privileged on public.users
  for update using (id = auth.uid() or public.is_privileged())
  with check (
    (id = auth.uid() and role = (select role from public.users u where u.id = auth.uid()))
    or public.is_privileged()
  );

-- items (public catalog read)
drop policy if exists items_public_read on public.items;
create policy items_public_read on public.items
  for select using (true);

drop policy if exists items_privileged_write on public.items;
create policy items_privileged_write on public.items
  for all using (public.is_privileged())
  with check (public.is_privileged());

-- promotions
drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read on public.promotions
  for select using (true);

drop policy if exists promotions_editor_write on public.promotions;
create policy promotions_editor_write on public.promotions
  for all using (public.is_promotions_editor())
  with check (public.is_promotions_editor());

-- orders
drop policy if exists orders_select_owner_or_staff on public.orders;
create policy orders_select_owner_or_staff on public.orders
  for select using (user_id = auth.uid() or public.is_staff_orders());

drop policy if exists orders_insert_own_pending on public.orders;
create policy orders_insert_own_pending on public.orders
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
  );

drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders
  for update using (public.is_staff_orders())
  with check (public.is_staff_orders());

-- order_items
drop policy if exists order_items_select_owner_or_staff on public.order_items;
create policy order_items_select_owner_or_staff on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.is_staff_orders())
    )
  );

drop policy if exists order_items_insert_own_order on public.order_items;
create policy order_items_insert_own_order on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.user_id = auth.uid()
        and o.status = 'pending'
    )
  );

drop policy if exists order_items_staff_update on public.order_items;
create policy order_items_staff_update on public.order_items
  for update using (public.is_staff_orders())
  with check (public.is_staff_orders());

-- favorites
drop policy if exists favorites_owner_all on public.user_favorites;
create policy favorites_owner_all on public.user_favorites
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- accounts
drop policy if exists accounts_settings_privileged on public.accounts_settings;
create policy accounts_settings_privileged on public.accounts_settings
  for all using (public.can_manage_accounts())
  with check (public.can_manage_accounts());

drop policy if exists accounts_entries_privileged on public.accounts_entries;
create policy accounts_entries_privileged on public.accounts_entries
  for all using (public.can_manage_accounts())
  with check (public.can_manage_accounts());

-- ---------------------------------------------------------------------------
-- Storage: fabrics bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fabrics',
  'fabrics',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fabrics_public_read on storage.objects;
create policy fabrics_public_read on storage.objects
  for select using (bucket_id = 'fabrics');

drop policy if exists fabrics_authenticated_upload on storage.objects;
create policy fabrics_authenticated_upload on storage.objects
  for insert with check (
    bucket_id = 'fabrics'
    and auth.role() = 'authenticated'
  );

drop policy if exists fabrics_privileged_update on storage.objects;
create policy fabrics_privileged_update on storage.objects
  for update using (
    bucket_id = 'fabrics'
    and public.is_privileged()
  )
  with check (
    bucket_id = 'fabrics'
    and public.is_privileged()
  );

drop policy if exists fabrics_privileged_delete on storage.objects;
create policy fabrics_privileged_delete on storage.objects
  for delete using (
    bucket_id = 'fabrics'
    and public.is_privileged()
  );

-- ---------------------------------------------------------------------------
-- Seed accounts settings (Sweta's Atelier)
-- ---------------------------------------------------------------------------
insert into public.accounts_settings (
  id,
  legal_name,
  trade_name,
  gstin,
  state_code,
  state_name,
  invoice_prefix,
  next_invoice_number,
  financial_year_label,
  default_gst_rate,
  default_tax_mode
)
values (
  'current',
  'Sweta''s Atelier',
  'Sweta''s Atelier',
  '',
  '27',
  'Maharashtra',
  'SWA',
  1,
  '2026-27',
  5,
  'intra_state'
)
on conflict (id) do nothing;
