import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("invalid")) setError("Email atau kata sandi salah.");
      else if (msg.toLowerCase().includes("confirm")) setError("Email belum dikonfirmasi. Nonaktifkan konfirmasi email di Supabase.");
      else setError(msg || "Gagal masuk. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAF7F8]">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-[#E83E8C]">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1779619023802-88e243982ed0?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200')" }}
        />
        <div className="relative flex items-center gap-3 text-white">
          <div className="h-11 w-11 rounded-xl bg-white/20 grid place-items-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>AURORA</p>
            <p className="text-xs tracking-[0.3em] font-semibold">SEWA KEBAYA</p>
          </div>
        </div>
        <div className="relative text-white">
          <h2 className="text-4xl font-bold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Sistem Manajemen &<br />POS Rental Kebaya Premium
          </h2>
          <p className="mt-4 text-white/80 max-w-md text-sm leading-relaxed">
            Kelola katalog, booking, rental, pembayaran, dan laporan dalam satu platform yang elegan dan profesional.
          </p>
        </div>
        <div className="relative text-white/60 text-xs">© 2026 Aurora Sewa Kebaya</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-xl bg-[#E83E8C] grid place-items-center text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-[#1F191E]" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem" }}>AURORA</p>
              <p className="text-[10px] tracking-[0.2em] text-[#E83E8C] font-semibold">SEWA KEBAYA</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-[#1F191E]">Selamat Datang</h1>
          <p className="mt-1 text-sm text-[#7A6A75]">Masuk ke akun Anda untuk melanjutkan.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <label className="text-sm font-medium text-[#4A3F47]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                placeholder="nama@email.com"
                className="mt-1.5 w-full rounded-lg border border-[#F0C4D6] bg-white px-3.5 py-2.5 text-sm text-[#1F191E] outline-none transition-all focus:border-[#E83E8C] focus:ring-2 focus:ring-[#FCE4EC]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#4A3F47]">Kata Sandi</label>
              <div className="relative mt-1.5">
                <input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#F0C4D6] bg-white px-3.5 py-2.5 pr-10 text-sm text-[#1F191E] outline-none transition-all focus:border-[#E83E8C] focus:ring-2 focus:ring-[#FCE4EC]"
                />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B79BAA]" data-testid="login-toggle-password">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-2.5 text-sm text-[#B91C1C]" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              data-testid="login-submit-btn"
              className="w-full rounded-lg bg-[#E83E8C] hover:bg-[#D62B78] disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Memproses…" : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
