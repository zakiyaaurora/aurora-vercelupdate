import { useAsync } from "@/lib/hooks";
import { dashboardStats, listBookings, listRentals, listPayments } from "@/lib/api";
import { formatRupiah, formatDateShort } from "@/lib/format";
import { PageHeader, StatCard, SectionCard, Loading, ErrorState, EmptyState, StatusBadge } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import {
  Boxes, CheckCircle2, Clock, CalendarCheck, TrendingUp, Wallet, AlertTriangle, Users,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [stats, bookings, rentals, payments] = await Promise.all([
      dashboardStats(), listBookings(), listRentals(), listPayments(),
    ]);
    return { stats, bookings, rentals, payments };
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const s = data.stats || {};
  const chartData = (s.revenue_7days || []).map((d) => ({
    label: formatDateShort(d.date).replace(/ \d{4}$/, ""),
    amount: Number(d.amount || 0),
  }));

  const upcoming = (data.bookings || [])
    .filter((b) => ["PENDING", "CONFIRMED", "READY", "PAID"].includes(b.status))
    .slice(0, 6);
  const dueRentals = (data.rentals || [])
    .filter((r) => ["OUT", "ACTIVE", "OVERDUE", "LATE"].includes(r.status))
    .slice(0, 6);
  const recentPayments = (data.payments || []).slice(0, 6);

  return (
    <div data-testid="dashboard-page">
      <PageHeader title={`Halo, ${profile?.name || "Admin"} 👋`} subtitle="Ringkasan operasional Aurora Sewa Kebaya hari ini." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard testid="stat-total-kebaya" label="Total Kebaya" value={s.total_products ?? 0} sub={`${s.total_units ?? 0} unit fisik`} icon={Boxes} tone="pink" />
        <StatCard testid="stat-available" label="Tersedia" value={s.available_units ?? 0} icon={CheckCircle2} tone="green" />
        <StatCard testid="stat-rented" label="Sedang Disewa" value={s.rented_units ?? 0} icon={Clock} tone="amber" />
        <StatCard testid="stat-bookings-today" label="Booking Hari Ini" value={s.bookings_today ?? 0} sub={`${s.upcoming_bookings ?? 0} mendatang`} icon={CalendarCheck} tone="purple" />
        <StatCard testid="stat-active-rentals" label="Rental Aktif" value={s.active_rentals ?? 0} sub={`${s.overdue_rentals ?? 0} terlambat`} icon={Clock} tone="blue" />
        <StatCard testid="stat-revenue-today" label="Pendapatan Hari Ini" value={formatRupiah(s.revenue_today)} icon={TrendingUp} tone="green" />
        <StatCard testid="stat-receivables" label="Piutang" value={formatRupiah(s.receivables)} icon={Wallet} tone="red" />
        <StatCard testid="stat-revenue-month" label="Pendapatan Bulan Ini" value={formatRupiah(s.revenue_month)} icon={TrendingUp} tone="pink" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <SectionCard title="Pendapatan 7 Hari Terakhir" className="lg:col-span-2" testid="revenue-chart">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E83E8C" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#E83E8C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#FCE4EC" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7A6A75" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#7A6A75" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ borderRadius: 12, border: "1px solid #F8D7E3", fontSize: 12 }} />
                <Area type="monotone" dataKey="amount" stroke="#E83E8C" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Perlu Perhatian" testid="attention-card">
          <div className="space-y-3">
            <AttentionRow icon={AlertTriangle} tone="red" label="Rental Terlambat" value={s.overdue_rentals ?? 0} />
            <AttentionRow icon={Wallet} tone="amber" label="Invoice Belum Lunas" value={formatRupiah(s.receivables)} />
            <AttentionRow icon={Boxes} tone="blue" label="Unit Maintenance" value={s.maintenance_units ?? 0} />
            <AttentionRow icon={AlertTriangle} tone="red" label="Rusak / Hilang" value={s.damaged_units ?? 0} />
            <AttentionRow icon={Users} tone="pink" label="Total Pelanggan" value={s.total_customers ?? 0} />
          </div>
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <SectionCard title="Booking Mendatang" testid="upcoming-bookings">
          {upcoming.length === 0 ? <EmptyState title="Tidak ada booking" /> : (
            <div className="space-y-2.5">
              {upcoming.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1F191E] truncate">{b.customer?.name || "-"}</p>
                    <p className="text-xs text-[#7A6A75]">{formatDateShort(b.start_date)} — {formatDateShort(b.end_date)}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Rental Harus Kembali" testid="due-rentals">
          {dueRentals.length === 0 ? <EmptyState title="Tidak ada rental aktif" /> : (
            <div className="space-y-2.5">
              {dueRentals.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1F191E] truncate">{r.customer?.name || "-"}</p>
                    <p className="text-xs text-[#7A6A75]">Jatuh tempo {formatDateShort(r.due_date)}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Transaksi Terbaru" testid="recent-payments">
          {recentPayments.length === 0 ? <EmptyState title="Belum ada pembayaran" /> : (
            <div className="space-y-2.5">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1F191E] truncate">{p.customer?.name || p.payment_number}</p>
                    <p className="text-xs text-[#7A6A75]">{p.payment_method} · {formatDateShort(p.payment_date)}</p>
                  </div>
                  <span className="font-semibold text-[#047857]">{formatRupiah(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function AttentionRow({ icon: Icon, tone, label, value }) {
  const tones = {
    red: "bg-[#FEF2F2] text-[#B91C1C]", amber: "bg-[#FEF3C7] text-[#B45309]",
    blue: "bg-[#E0F2FE] text-[#0369A1]", pink: "bg-[#FFF5F8] text-[#E83E8C]",
  };
  return (
    <div className="flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg grid place-items-center ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm text-[#4A3F47] flex-1">{label}</p>
      <p className="font-semibold text-[#1F191E]">{value}</p>
    </div>
  );
}
