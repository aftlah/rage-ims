-- RAGE IMS: app_settings
-- Jalankan saat traffic sepi. Kalau tabel sudah ada, cukupini opsional
-- (penghapusan markup % cukupi di kode app, bukan wajib SQL).
--
-- Tip deadlock: jalankan per blok (satu blok per eksekusi), jangan sekaligus
-- dalam satu transaksi panjang saat ada user login / Settings terbuka.

-- ========== BLOK 1: tabel + seed ==========
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id) on delete set null
);

comment on table public.app_settings is
  'Key/value site settings (maintenance, delete PIN, notices). PIN is client-checked only.';

insert into public.app_settings (key, value)
values
  ('maintenance_mode', 'false'::jsonb),
  ('maintenance_message', '"Sedang maintenance: Sebentar yaa kawan"'::jsonb),
  ('admin_delete_pin', '""'::jsonb),
  ('site_notice', '""'::jsonb),
  ('weekly_profit_viewers', '[]'::jsonb)
on conflict (key) do nothing;

-- Opsional: hapus setting markup lama (aman diabaikan kalau tidak ada)
delete from public.app_settings
where key = 'gun_attachment_markup_pct';

-- ========== BLOK 2: helper admin ==========
-- (jalankan terpisah dari BLOK 1 kalau deadlock)
create or replace function public.rage_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.auth_user_id = auth.uid()
      and lower(trim(coalesce(m.role, ''))) = 'admin'
  );
$$;

revoke all on function public.rage_is_admin() from public;
grant execute on function public.rage_is_admin() to authenticated;

-- ========== BLOK 3: RLS + policy ==========
-- (jalankan terpisah; AccessExclusiveLock sering bentrok dengan query app)
alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_authenticated"
  on public.app_settings
  for select
  to authenticated
  using (true);

drop policy if exists "app_settings_insert_admin" on public.app_settings;
create policy "app_settings_insert_admin"
  on public.app_settings
  for insert
  to authenticated
  with check (public.rage_is_admin());

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin"
  on public.app_settings
  for update
  to authenticated
  using (public.rage_is_admin())
  with check (public.rage_is_admin());

grant select on public.app_settings to authenticated;
grant insert, update on public.app_settings to authenticated;
