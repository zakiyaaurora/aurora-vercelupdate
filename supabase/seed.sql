-- =====================================================================
-- AURORA SEWA KEBAYA — DEMO SEED (business data only)
-- Run AFTER 001_init.sql. Auth users are seeded via scripts/seed_users.mjs
-- Safe to re-run: uses stable codes / on conflict.
-- =====================================================================

-- Categories
insert into public.categories (name, description) values
  ('Kebaya','Kebaya tradisional & modern'),
  ('Dress','Gaun & dress pesta'),
  ('Set','Set kebaya lengkap'),
  ('Hijab','Hijab & kerudung'),
  ('Aksesoris','Aksesoris pelengkap'),
  ('Selendang','Selendang & shawl')
on conflict do nothing;

-- Products
with c as (select id, name from public.categories)
insert into public.products (product_code, name, category_id, description, color, size, material, brand, rental_price, deposit, late_fee_per_day, purchase_price, photo_url)
select * from (values
  ('PRD-0001','Kebaya Rose Gold Premium', (select id from c where name='Kebaya'),'Kebaya brokat rose gold dengan payet mewah','Rose Gold','M','Brokat',NULL, 500000, 500000, 50000, 2500000,'https://images.unsplash.com/photo-1754925434445-fc9bb09ea8ff?crop=entropy&cs=srgb&fm=jpg&q=85&w=800'),
  ('PRD-0002','Kebaya Pink Silk Elegant',(select id from c where name='Kebaya'),'Kebaya sutra pink lembut elegan','Pink','S','Sutra',NULL, 450000, 400000, 40000, 2000000,'https://images.unsplash.com/photo-1779619023802-88e243982ed0?crop=entropy&cs=srgb&fm=jpg&q=85&w=800'),
  ('PRD-0003','Gaun Bridal Gold',(select id from c where name='Dress'),'Gaun pengantin warna emas','Gold','L','Satin',NULL, 750000, 750000, 75000, 5000000,'https://images.unsplash.com/photo-1779619011908-cc586d6b1191?crop=entropy&cs=srgb&fm=jpg&q=85&w=800'),
  ('PRD-0004','Kebaya Modern Lavender',(select id from c where name='Kebaya'),'Kebaya modern warna lavender','Lavender','M','Tile',NULL, 400000, 350000, 40000, 1800000,'https://images.unsplash.com/photo-1673185478488-5c8b3be8d53d?crop=entropy&cs=srgb&fm=jpg&q=85&w=800'),
  ('PRD-0005','Kebaya Klasik Biru',(select id from c where name='Set'),'Set kebaya klasik warna biru dengan kain batik','Biru','L','Brokat',NULL, 550000, 500000, 55000, 2800000,'https://images.unsplash.com/photo-1580308388075-738727692cdb?crop=entropy&cs=srgb&fm=jpg&q=85&w=800')
) as v
on conflict (product_code) do nothing;

-- Inventory units (3 units for first 2 products, 2 for the rest)
insert into public.inventory_items (product_id, sku, condition, status, location)
select p.id, p.product_code || '-U' || g.n, 'GOOD', 'AVAILABLE', 'Rak A'
from public.products p
cross join generate_series(1, 3) g(n)
where p.product_code in ('PRD-0001','PRD-0002')
on conflict (sku) do nothing;

insert into public.inventory_items (product_id, sku, condition, status, location)
select p.id, p.product_code || '-U' || g.n, 'GOOD', 'AVAILABLE', 'Rak B'
from public.products p
cross join generate_series(1, 2) g(n)
where p.product_code in ('PRD-0003','PRD-0004','PRD-0005')
on conflict (sku) do nothing;

-- Customers with measurements
insert into public.customers (customer_code, name, phone, whatsapp, email, address, gender, lingkar_dada, lingkar_perut, lingkar_lengan, lingkar_ketiak, tinggi_badan, berat_badan, panjang_badan, panjang_lengan)
values
  ('CST-0001','Siti Nurhaliza','081234567890','081234567890','siti@example.com','Jl. Melati No. 12, Jakarta','P', 88, 76, 28, 40, 165, 55, 92, 58),
  ('CST-0002','Dewi Anggraini','081298765432','081298765432','dewi@example.com','Jl. Mawar No. 5, Bandung','P', 92, 80, 30, 42, 160, 60, 90, 56),
  ('CST-0003','Rina Wulandari','081377788899','081377788899','rina@example.com','Jl. Kenanga No. 8, Surabaya','P', 85, 72, 27, 38, 168, 52, 94, 60)
on conflict (customer_code) do nothing;
