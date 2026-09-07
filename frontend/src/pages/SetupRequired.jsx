import { Sparkles, Database, KeyRound, Terminal } from "lucide-react";

export default function SetupRequired() {
  return (
    <div className="min-h-screen bg-[#FAF7F8] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white border border-[#F8D7E3] rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-[#E83E8C] grid place-items-center text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-[#1F191E]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.4rem" }}>AURORA SEWA KEBAYA</p>
            <p className="text-xs text-[#7A6A75]">Konfigurasi Supabase diperlukan</p>
          </div>
        </div>

        <div className="rounded-lg bg-[#FFF5F8] border border-[#F8D7E3] p-4 text-sm text-[#4A3F47]">
          Aplikasi ini menggunakan <b>Supabase</b> sebagai database, autentikasi, dan storage.
          Silakan lengkapi kredensial berikut di file <code className="text-[#E83E8C]">frontend/.env</code> lalu restart.
        </div>

        <div className="mt-6 space-y-4">
          <Step icon={Database} n="1" title="Buat project di Supabase">
            Buka <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-[#E83E8C] underline">supabase.com/dashboard</a> → New Project. Simpan Database Password.
          </Step>
          <Step icon={Terminal} n="2" title="Jalankan SQL Migration">
            Buka <b>SQL Editor</b> → tempel isi <code>supabase/migrations/001_init.sql</code>, jalankan. Lalu jalankan <code>supabase/seed.sql</code>.
          </Step>
          <Step icon={KeyRound} n="3" title="Isi kredensial ke frontend/.env">
            Ambil dari <b>Project Settings → API</b>:
            <pre className="mt-2 rounded-lg bg-[#1F191E] text-[#F8D7E3] p-3 text-xs overflow-x-auto">{`REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOi...`}</pre>
          </Step>
        </div>

        <p className="mt-6 text-xs text-[#7A6A75]">
          Panduan lengkap ada di <code>SUPABASE_SETUP.md</code>. Setelah kredensial diisi, halaman ini akan berganti menjadi halaman login.
        </p>
      </div>
    </div>
  );
}

function Step({ icon: Icon, n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-[#FCE4EC] text-[#E83E8C] grid place-items-center font-bold text-sm">{n}</div>
      <div className="min-w-0">
        <p className="font-semibold text-[#1F191E] flex items-center gap-2"><Icon className="h-4 w-4 text-[#E83E8C]" /> {title}</p>
        <div className="mt-1 text-sm text-[#4A3F47] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
