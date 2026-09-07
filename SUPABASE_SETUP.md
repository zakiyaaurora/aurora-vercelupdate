# Panduan Setup Supabase — AURORA SEWA KEBAYA

## 1. Buat Project
1. Buka https://supabase.com/dashboard → **New project**.
2. Isi nama (mis. `aurora-sewa-kebaya`), simpan **Database Password**, pilih region terdekat (Singapore).
3. Tunggu project selesai dibuat (~2 menit).

## 2. Jalankan Migration
1. Sidebar → **SQL Editor** → **New query**.
2. Tempel seluruh isi `supabase/migrations/001_init.sql` → **Run**.
3. New query lagi → tempel isi `supabase/seed.sql` → **Run** (data demo).

## 3. Storage untuk Foto Produk
Cara termudah: **SQL Editor → New query → tempel isi `supabase/migrations/002_storage.sql` → Run.**
Ini membuat bucket publik `product-images` sekaligus policy baca-publik & tulis-untuk-user-login.

(Alternatif manual: Storage → New bucket `product-images` (Public), lalu tambahkan policy INSERT/UPDATE/DELETE
untuk role `authenticated` di `storage.objects` — tanpa policy ini upload foto akan gagal karena RLS.)

## 4. Authentication
1. **Authentication → Providers → Email**: pastikan Email enabled.
2. **Authentication → Providers → Email → Confirm email**: **matikan** (agar user demo bisa langsung login).
3. **Authentication → URL Configuration**: tambahkan URL preview & produksi (Vercel) sebagai Redirect URLs.

## 5. Ambil Kredensial
**Project Settings → API**:
- `Project URL` → `REACT_APP_SUPABASE_URL`
- `anon public` key → `REACT_APP_SUPABASE_ANON_KEY`

Isi ke `frontend/.env`:
```
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOi...
```
Lalu restart frontend.

## 6. Seed User Awal (service_role, lokal saja)
`service_role` key ada di **Project Settings → API → service_role**. JANGAN pernah taruh di frontend.

1. Buat file `scripts/.env.seed` (jangan commit):
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...service_role...
   OWNER_EMAIL=zakiyazkr8@gmail.com
   OWNER_PASSWORD=aurora123
   ```
2. Jalankan:
   ```
   cd scripts && npm install @supabase/supabase-js && node seed_users.mjs
   ```
   (atau dari root: `node scripts/seed_users.mjs`)

Setelah itu login dengan email owner + password `aurora123`.

## Troubleshooting
- **Login gagal "Email not confirmed"** → matikan Confirm email (langkah 4.2), atau konfirmasi user via dashboard.
- **Upload foto gagal (RLS)** → pastikan bucket `product-images` sudah dibuat & publik.
- **Data tidak muncul / 401** → pastikan `.env` benar & sudah restart; pastikan migration & RLS policy berhasil dijalankan.
- **`current_role()` error** → pastikan seluruh `001_init.sql` dijalankan sampai selesai.
