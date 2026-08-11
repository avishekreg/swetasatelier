-- Safe patch for projects that already ran supabase-schema.sql
drop policy if exists users_insert_self_customer on public.users;
create policy users_insert_self_customer on public.users
  for insert with check (id = auth.uid() and role = 'customer');
