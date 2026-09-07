# AURORA SEWA KEBAYA

Aplikasi manajemen & POS rental kebaya profesional.
**Arsitektur:** React (Create React App) + Supabase (PostgreSQL, Auth, Storage) → deploy ke Vercel.

## Fitur
- Dashboard KPI real-time + grafik pendapatan
- Katalog produk + upload foto (Supabase Storage) + cek ketersediaan berbasis tanggal
- Availability engine (mencegah double booking) via fungsi PostgreSQL
- Pelanggan + ukuran badan + riwayat transaksi
- Booking → Checkout Rental → Return (dengan denda/kerusakan) — atomic (RPC)
- POS/Kasir terhubung: customer → produk → tanggal → cart → pembayaran → invoice
- Stok/inventaris per unit + stock movements
- Pembayaran parsial (DP/pelunasan) + invoice cetak/PDF
- Laporan + export CSV
- Manajemen pengguna (OWNER/ADMIN/KASIR/STAFF) + RLS + audit log

## Struktur
```
frontend/            # React app (deploy ke Vercel)
  src/
    lib/             # supabaseClient, api, format, constants, hooks
    context/         # AuthContext (satu-satunya)
    components/      # layout + form + common
    pages/           # semua halaman modul
supabase/
  migrations/001_init.sql   # schema + RLS + RPC functions
  migrations/002_storage.sql # bucket product-images + storage policies
  seed.sql                  # data bisnis demo
scripts/seed_users.mjs      # seed user auth (service_role, lokal saja)
```

## Setup singkat
Lihat **SUPABASE_SETUP.md** untuk langkah lengkap. Ringkas:
1. Buat project Supabase.
2. Jalankan `supabase/migrations/001_init.sql` lalu `supabase/seed.sql` di SQL Editor.
3. Jalankan `supabase/migrations/002_storage.sql` (membuat bucket `product-images` + policy).
4. Nonaktifkan konfirmasi email (Authentication → Providers → Email).
5. Isi `frontend/.env`:
   ```
   REACT_APP_SUPABASE_URL=...
   REACT_APP_SUPABASE_ANON_KEY=...
   ```
6. Seed user: isi `scripts/.env.seed` lalu `node scripts/seed_users.mjs`.

## Kredensial demo
Password semua akun: `aurora123`
- OWNER: zakiyazkr8@gmail.com
- ADMIN: admin@aurora.com
- KASIR: kasir@aurora.com
- STAFF: staff@aurora.com

## Alur antar modul
```
CUSTOMER → BOOKING → (availability) → INVENTORY → RENTAL → RETURN → STOCK
                         ↓
                     INVOICE → PAYMENT
```

## Deployment
Lihat **DEPLOYMENT.md** (Vercel + Supabase).
