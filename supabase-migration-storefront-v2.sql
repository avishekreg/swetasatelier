-- Sweta's Atelier — Storefront / Inventory / Reviews / Barcode migration
-- Run in Supabase SQL Editor AFTER supabase-schema.sql (or on an existing project).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.showcase_type as enum ('ready_stock', 'delivered_craft');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- items: cost, showcase, barcode
-- ---------------------------------------------------------------------------
alter table public.items
  add column if not exists cost_price numeric(12, 2) check (cost_price is null or cost_price >= 0),
  add column if not exists showcase_type public.showcase_type not null default 'ready_stock',
  add column if not exists barcode_string text unique,
  add column if not exists barcode_url text,
  add column if not exists sku text,
  add column if not exists gst_rate numeric(5, 2) default 5
    check (gst_rate is null or gst_rate in (0, 3, 5, 12, 18, 28)),
  add column if not exists is_published boolean not null default true,
  add column if not exists source_order_id uuid references public.orders (id) on delete set null;

create index if not exists items_showcase_type_idx on public.items (showcase_type);
create index if not exists items_barcode_string_idx on public.items (barcode_string);
create index if not exists items_sku_idx on public.items (sku);

alter table public.order_items
  add column if not exists unit_cost numeric(12, 2) check (unit_cost is null or unit_cost >= 0);

-- ---------------------------------------------------------------------------
-- accounts_entries: cost / margin / profit (optional per invoice)
-- ---------------------------------------------------------------------------
alter table public.accounts_entries
  add column if not exists cost_amount numeric(12, 2) default 0 check (cost_amount >= 0),
  add column if not exists margin_amount numeric(12, 2) default 0,
  add column if not exists profit_amount numeric(12, 2) default 0;

-- ---------------------------------------------------------------------------
-- system_settings (singleton + barcode master toggle)
-- ---------------------------------------------------------------------------
create table if not exists public.system_settings (
  id text primary key default 'current' check (id = 'current'),
  enable_barcode_inventory boolean not null default false,
  enable_model_shot_ai boolean not null default true,
  default_gst_rate numeric(5, 2) not null default 5
    check (default_gst_rate in (0, 3, 5, 12, 18, 28)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();

insert into public.system_settings (id, enable_barcode_inventory, enable_model_shot_ai, default_gst_rate)
values ('current', false, true, 5)
on conflict (id) do nothing;

alter table public.system_settings enable row level security;

drop policy if exists system_settings_read_authenticated on public.system_settings;
create policy system_settings_read_authenticated on public.system_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists system_settings_privileged_write on public.system_settings;
create policy system_settings_privileged_write on public.system_settings
  for all using (public.is_privileged())
  with check (public.is_privileged());

-- ---------------------------------------------------------------------------
-- reviews (verified client diary under delivered_craft items)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text not null default '',
  client_photo_url text,
  is_verified boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, item_id, user_id)
);

create index if not exists reviews_item_id_idx on public.reviews (item_id);
create index if not exists reviews_user_id_idx on public.reviews (user_id);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

-- Public can read published reviews (storefront social proof)
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
  for select using (is_published = true or user_id = auth.uid() or public.is_privileged());

-- Customer may insert a review only for their own delivered order line
drop policy if exists reviews_owner_insert on public.reviews;
create policy reviews_owner_insert on public.reviews
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.id = order_id
        and o.user_id = auth.uid()
        and o.status = 'delivered'
        and oi.item_id = reviews.item_id
    )
  );

drop policy if exists reviews_owner_update on public.reviews;
create policy reviews_owner_update on public.reviews
  for update using (user_id = auth.uid() or public.is_privileged())
  with check (user_id = auth.uid() or public.is_privileged());

drop policy if exists reviews_privileged_delete on public.reviews;
create policy reviews_privileged_delete on public.reviews
  for delete using (public.is_privileged());

-- ---------------------------------------------------------------------------
-- Helper: only privileged (or promotions for delivered_craft publish) write items
-- Existing items policies already use is_privileged() — keep as-is.
-- Promotions role may update delivered_craft publish flags if desired later.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Stock decrement helper (call from service-role webhook / order completion)
-- ---------------------------------------------------------------------------
create or replace function public.decrement_stock_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select oi.item_id, oi.quantity
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.item_id is not null
  loop
    update public.items
    set stock = greatest(0, stock - r.quantity),
        updated_at = now()
    where id = r.item_id
      and showcase_type = 'ready_stock';
  end loop;
end;
$$;

revoke all on function public.decrement_stock_for_order(uuid) from public;
grant execute on function public.decrement_stock_for_order(uuid) to service_role;
