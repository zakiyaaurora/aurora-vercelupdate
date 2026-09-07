import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks";
import { publicCatalog, catalogAvailability, checkAvailability } from "@/lib/api";
import { todayISO, addDays, formatDateShort } from "@/lib/format";
import { availabilityText } from "@/lib/availability";
import { useAuth } from "@/context/AuthContext";
import { Loading, ErrorState, EmptyState } from "@/components/common";
import { Field, TextInput, NativeSelect, Btn, SearchInput } from "@/components/form";
import CatalogCard from "@/components/CatalogCard";
import ScheduleModal from "@/components/ScheduleModal";
import { Sparkles, CalendarSearch, LogIn, LayoutDashboard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Katalog publik (/sewa) — dapat diakses tanpa login.
 * Menampilkan foto, nama, harga, stok tersedia & tanggal tidak tersedia.
 * Identitas penyewa TIDAK ditampilkan (disamarkan oleh server).
 */
export default function PublicCatalog() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(publicCatalog, []);

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [availFilter, setAvailFilter] = useState("");
  const [range, setRange] = useState({ start: todayISO(), end: addDays(todayISO(), 2) });
  const [avail, setAvail] = useState({});
  const [checking, setChecking] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [schedule, setSchedule] = useState(null);

  const products = useMemo(() => data?.products || [], [data]);
  const categories = useMemo(() => data?.categories || [], [data]);
  const rangeValid = range.start && range.end && range.end >= range.start;

  const runAvailability = useCallback(async () => {
    if (!rangeValid) return;
    setChecking(true);
    try {
      const rows = await catalogAvailability(range.start, range.end);
      const map = {};
      (rows || []).forEach((r) => { map[r.product_id] = r; });
      setAvail(map);
    } catch (e) {
      toast.error(e.message || "Gagal cek ketersediaan");
    } finally {
      setChecking(false);
    }
  }, [range.start, range.end, rangeValid]);

  useEffect(() => { runAvailability(); }, [runAvailability]);

  const checkOne = async (p) => {
    if (!rangeValid) { toast.error("Tanggal selesai harus setelah tanggal mulai"); return; }
    setCheckingId(p.id);
    try {
      const a = await checkAvailability(p.id, range.start, range.end);
      setAvail((m) => ({ ...m, [p.id]: { product_id: p.id, ...a } }));
      const text = availabilityText(a);
      if (Number(a.available) > 0) toast.success(`${p.name}: ${text}`); else toast.error(`${p.name}: ${text}`);
    } catch (e) { toast.error(e.message || "Gagal cek ketersediaan"); }
    finally { setCheckingId(null); }
  };

  const filtered = useMemo(() => products.filter((p) => {
    const q = search.toLowerCase();
    const okSearch = !q || p.name.toLowerCase().includes(q) || (p.product_code || "").toLowerCase().includes(q) || (p.color || "").toLowerCase().includes(q);
    const okCat = !cat || p.category_id === cat;
    const a = avail[p.id];
    const okAvail = !availFilter || (a && (availFilter === "available" ? Number(a.available) > 0 : Number(a.available) <= 0));
    return okSearch && okCat && okAvail;
  }), [products, search, cat, availFilter, avail]);

  const availableCount = useMemo(() => products.filter((p) => Number(avail[p.id]?.available || 0) > 0).length, [products, avail]);

  return (
    <div className="min-h-screen bg-[#FAF7F8]" data-testid="public-catalog-page">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#F8D7E3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#E83E8C] grid place-items-center text-white shrink-0"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="font-bold text-[#1F191E] leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.25rem" }}>AURORA</p>
            <p className="text-[10px] tracking-[0.2em] text-[#7A6A75] -mt-0.5">SEWA KEBAYA</p>
          </div>
          <div className="ml-auto">
            {user ? (
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-[#FFF5F8] border border-[#F8D7E3] px-3.5 py-2 text-sm font-medium text-[#E83E8C] hover:bg-[#FCE4EC]" data-testid="public-dashboard-link">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-[#E83E8C] hover:bg-[#D62B78] px-3.5 py-2 text-sm font-medium text-white shadow-sm" data-testid="public-login-link">
                <LogIn className="h-4 w-4" /> Masuk Staff
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-[#E83E8C] to-[#F06AA5] text-white p-6 sm:p-8 shadow-lg">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Cek Ketersediaan Kebaya</h1>
          <p className="mt-1.5 text-sm text-white/90 max-w-xl">
            Pilih tanggal sewa untuk melihat kebaya yang tersedia. Ketersediaan dihitung langsung dari jadwal booking &amp; rental terkini.
          </p>
          <div className="mt-5 grid sm:grid-cols-4 gap-3 items-end bg-white/95 rounded-xl p-3 sm:p-4 text-[#1F191E]">
            <Field label="Tanggal Mulai Sewa"><TextInput type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} data-testid="public-start-date" /></Field>
            <Field label="Tanggal Selesai Sewa"><TextInput type="date" value={range.end} min={range.start} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} data-testid="public-end-date" /></Field>
            <Btn onClick={runAvailability} loading={checking} className="py-2.5" data-testid="public-check-availability"><CalendarSearch className="h-4 w-4" /> Cek Ketersediaan</Btn>
            <p className="text-xs text-[#7A6A75] sm:pb-2.5" data-testid="public-availability-summary">
              {rangeValid ? <>{formatDateShort(range.start)} – {formatDateShort(range.end)}: <b className="text-[#047857]">{availableCount}</b> dari {products.length} produk tersedia</> : <span className="text-[#B91C1C]">Tanggal selesai harus setelah tanggal mulai</span>}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 bg-white border border-[#F8D7E3] rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama / kode / warna…" testid="public-search" />
          <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Semua Kategori" options={categories.map((c) => ({ value: c.id, label: c.name }))} className="sm:w-48" data-testid="public-category-filter" />
          <NativeSelect value={availFilter} onChange={(e) => setAvailFilter(e.target.value)} placeholder="Semua Status"
            options={[{ value: "available", label: "Hanya yang tersedia" }, { value: "unavailable", label: "Tidak tersedia" }]} className="sm:w-52" data-testid="public-availability-filter" />
          <p className="sm:ml-auto text-xs text-[#7A6A75] inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#047857]" /> Identitas penyewa lain tidak ditampilkan</p>
        </div>

        {/* Grid */}
        <div className="mt-6">
          {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : filtered.length === 0 ? (
            <EmptyState title="Tidak ada kebaya yang cocok" subtitle="Coba ubah tanggal, kategori, atau kata kunci pencarian." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="public-product-grid">
              {filtered.map((p) => (
                <CatalogCard key={p.id} product={p} avail={avail[p.id]} checking={checkingId === p.id} publicMode
                  onCheck={checkOne} onSchedule={(prod) => setSchedule(prod)} />
              ))}
            </div>
          )}
        </div>

        <footer className="mt-10 text-center text-xs text-[#7A6A75]">© {new Date().getFullYear()} Aurora Sewa Kebaya</footer>
      </main>

      <ScheduleModal product={schedule} open={!!schedule} onClose={() => setSchedule(null)} startDate={rangeValid ? range.start : null} endDate={rangeValid ? range.end : null} />
    </div>
  );
}
