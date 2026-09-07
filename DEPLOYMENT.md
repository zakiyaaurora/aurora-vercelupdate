# Deployment — Vercel + Supabase

## Prasyarat
- Setup Supabase selesai (lihat `SUPABASE_SETUP.md`).
- Repo sudah di GitHub.

## Deploy Frontend ke Vercel
1. https://vercel.com → **Add New Project** → import repo GitHub.
2. **Root Directory**: `frontend`
3. **Framework Preset**: Create React App
4. **Build Command**: `yarn build` (atau `npm run build`)
5. **Output Directory**: `build`
6. **Environment Variables** (Production & Preview):
   ```
   REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
7. Deploy.

`frontend/vercel.json` sudah menyediakan SPA rewrite agar React Router bekerja pada deep link.

## Setelah Deploy
- Tambahkan URL Vercel ke Supabase **Authentication → URL Configuration → Redirect URLs**.
- Uji: login, dashboard, buat customer/produk, POS, invoice.

## Catatan Keamanan
- Hanya `anon key` yang boleh ada di frontend/Vercel. `service_role` HANYA untuk `scripts/seed_users.mjs` di lokal.
- Semua tabel diproteksi RLS. Role dibaca dari tabel `profiles` (bukan input client).
- Jangan commit `.env`, `.env.seed`.
