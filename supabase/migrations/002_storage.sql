-- =====================================================================
-- AURORA SEWA KEBAYA — 002: Storage bucket + policies untuk foto produk
-- Jalankan SETELAH 001_init.sql. Aman dijalankan ulang (idempotent).
-- Menggantikan langkah manual "buat bucket product-images" di dashboard.
-- =====================================================================

-- Bucket publik untuk foto produk (baca publik, tulis hanya user login)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Baca: siapa pun (bucket publik) — dibutuhkan agar <img src=publicUrl> tampil
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Unggah: hanya user terautentikasi (staff toko)
drop policy if exists "product_images_auth_insert" on storage.objects;
create policy "product_images_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

-- Ubah / hapus: hanya user terautentikasi
drop policy if exists "product_images_auth_update" on storage.objects;
create policy "product_images_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "product_images_auth_delete" on storage.objects;
create policy "product_images_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');
