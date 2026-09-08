-- RAGE IMS: add sell_price to catalog_items
-- Jalankan sekali di Supabase SQL Editor.

alter table public.catalog_items
  add column if not exists sell_price numeric null;

comment on column public.catalog_items.sell_price is
  'Harga jual member. Null = pakai price (base) sebagai harga jual.';

-- Isi awal: harga jual = harga base yang sudah ada
update public.catalog_items
set sell_price = price
where sell_price is null
  and price is not null;
