import { useAsync } from "@/lib/hooks";
import { useNavigate } from "react-router-dom";
import {
  dashboardStats,
  listBookings,
  listRentals,
  listPayments,
  getCustomerRequests,
} from "@/lib/api";
import {
  formatRupiah,
  formatDateShort,
} from "@/lib/format";
import {
  PageHeader,
  StatCard,
  SectionCard,
  Loading,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import {
  Boxes,
  CheckCircle2,
  Clock,
  CalendarCheck,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Users,
  Package,
  CalendarClock,
  RotateCcw,
  Truck,
  ClipboardList,
  WashingMachine,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ============================================================
   DATE HELPERS
============================================================ */

function dateOnly(value) {
  if (!value) return null;

  const d = new Date(`${value}T00:00:00`);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d;
}

function diffDays(from, to) {
  const a = dateOnly(from);
  const b = dateOnly(to);

  if (!a || !b) return null;

  return Math.round(
    (b.getTime() - a.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function todayDate() {
  const d = new Date();

  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );
}

function isoToday() {
  const d = todayDate();

  const y = d.getFullYear();
  const m = String(
    d.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    d.getDate()
  ).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

/* ============================================================
   DASHBOARD
============================================================ */

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const {
    data,
    loading,
    error,
    reload,
  } = useAsync(async () => {
    const [
      stats,
      bookings,
      rentals,
      payments,
      customerRequests,
    ] = await Promise.all([
      dashboardStats(),
      listBookings(),
      listRentals(),
      listPayments(),
      getCustomerRequests("PENDING").catch(() => []),
    ]);

    return {
      stats,
      bookings,
      rentals,
      payments,
      customerRequests,
    };
  }, []);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={reload}
      />
    );
  }

  const s = data.stats || {};

  const bookings =
    data.bookings || [];

  const rentals =
    data.rentals || [];

  const payments =
    data.payments || [];

  const pendingCustomerRequests =
    Array.isArray(data.customerRequests) ? data.customerRequests : [];

  /* ============================================================
     REVENUE CHART
  ============================================================ */

  const chartData = (
    s.revenue_7days || []
  ).map((d) => ({
    label: formatDateShort(
      d.date
    ).replace(/ \d{4}$/, ""),
    amount: Number(
      d.amount || 0
    ),
  }));

  /* ============================================================
     BOOKING STATUS
  ============================================================ */

  const upcomingBookings =
    bookings.filter((b) =>
      [
        "PENDING",
        "CONFIRMED",
        "READY",
        "PAID",
      ].includes(b.status)
    );

  const upcoming =
    upcomingBookings.slice(0, 6);

  /* ============================================================
     ACTIVE RENTALS
  ============================================================ */

  const activeRentals =
    rentals.filter((r) =>
      [
        "OUT",
        "ACTIVE",
        "OVERDUE",
        "LATE",
      ].includes(r.status)
    );

  /* ============================================================
     RENTALS AKAN KEMBALI
  ============================================================ */

  const today = isoToday();

  const dueRentals =
    activeRentals
      .filter((r) => {
        if (!r.due_date) {
          return false;
        }

        const days = diffDays(
          today,
          r.due_date
        );

        return (
          days !== null &&
          days >= 0 &&
          days <= 7
        );
      })
      .sort((a, b) =>
        String(a.due_date || "").localeCompare(
          String(b.due_date || "")
        )
      );

  const dueRentalsDisplay =
    dueRentals.length > 0
      ? dueRentals.slice(0, 6)
      : activeRentals.slice(0, 6);

  /* ============================================================
     SHIPPING / KIRIMAN
     
     Menampilkan booking SHIPPING yang:
     - akan dikirim dalam 3 hari
     - atau wajib kirim kembali dalam 3 hari
     ============================================================ */

  const shippingBookings =
    bookings.filter(
      (b) =>
        b.pickup_method ===
          "SHIPPING" &&
        ![
          "CANCELLED",
          "RETURNED",
        ].includes(b.status)
    );

  const shippingAlerts =
    shippingBookings
      .map((b) => {
        const sendDays = b.shipping_date
          ? diffDays(
              today,
              b.shipping_date
            )
          : null;

        const returnDays =
          b.return_ship_date
            ? diffDays(
                today,
                b.return_ship_date
              )
            : null;

        let type = null;
        let priority = 99;

        if (
          sendDays !== null &&
          sendDays >= 0 &&
          sendDays <= 3
        ) {
          type = "SEND";
          priority = sendDays;
        }

        if (
          returnDays !== null &&
          returnDays >= 0 &&
          returnDays <= 3 &&
          returnDays < priority
        ) {
          type = "RETURN";
          priority = returnDays;
        }

        return {
          ...b,
          shippingType: type,
          shippingPriority:
            priority,
        };
      })
      .filter(
        (b) =>
          b.shippingType
      )
      .sort(
        (a, b) =>
          a.shippingPriority -
          b.shippingPriority
      );

  const shippingDisplay =
    shippingAlerts.slice(0, 6);

  /* ============================================================
     RECENT PAYMENTS
  ============================================================ */

  const recentPayments =
    payments.slice(0, 6);

  /* ============================================================
     COUNTS
  ============================================================ */

  const akanDisewaCount =
    upcomingBookings.length;

  const sedangDisewaCount =
    s.rented_units ??
    activeRentals.length ??
    0;

  const akanKembaliCount =
    dueRentals.length;

  return (
    <div
      data-testid="dashboard-page"
      className="space-y-6"
    >
      <style>{`@keyframes dashboardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } .dashboard-stat-button { border-radius: 1rem; transition: transform 220ms ease, box-shadow 220ms ease; } .dashboard-stat-button:hover { transform: translateY(-3px); } .dashboard-stat-button:focus-visible { outline: 2px solid #E83E8C; outline-offset: 3px; } @media (prefers-reduced-motion: reduce) { .dashboard-stat-button, [class*="animate-[dashboardIn"] { animation: none !important; transition: none !important; } }`}</style>

      {/* ========================================================
          HEADER
      ======================================================== */}

      <PageHeader
        title={`Halo, ${
          profile?.name ||
          "Admin"
        } 👋`}
        subtitle="Ringkasan operasional Aurora Sewa Kebaya hari ini."
      />

      {/* ========================================================
          STATUS OPERASIONAL UTAMA
      ======================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* AKAN DISEWA */}
        <OperationalCard
          testid="operational-upcoming"
          title="Akan Disewa"
          value={
            akanDisewaCount
          }
          subtitle="Booking mendatang"
          icon={CalendarClock}
          tone="blue"
          onClick={() => navigate("/booking")}
        />

        {/* SEDANG DISEWA */}
        <OperationalCard
          testid="operational-rented"
          title="Sedang Disewa"
          value={
            sedangDisewaCount
          }
          subtitle="Unit sedang keluar"
          icon={Clock}
          tone="amber"
          onClick={() => navigate("/rental")}
        />

        {/* AKAN KEMBALI */}
        <OperationalCard
          testid="operational-return"
          title="Akan Kembali"
          value={
            akanKembaliCount
          }
          subtitle="Dalam 7 hari"
          icon={RotateCcw}
          tone="green"
          onClick={() => navigate("/rental")}
        />

        {/* KIRIMAN */}
        <OperationalCard
          testid="operational-shipping"
          title="Customer Request"
          value={pendingCustomerRequests.length}
          subtitle="Menunggu diproses"
          icon={ClipboardList}
          tone="pink"
          onClick={() => navigate("/customer-requests")}
        />

      </div>

      {/* ========================================================
          STATUS KIRIMAN + STATUS BOOKING
      ======================================================== */}

      <div className="grid lg:grid-cols-3 gap-6">

        {/* BOOKING MENDATANG */}
        <SectionCard
          title="📅 Booking Akan Disewa"
          testid="dashboard-booking-status"
          className="lg:col-span-2"
        >
          {upcoming.length === 0 ? (
            <EmptyState
              title="Tidak ada booking mendatang"
            />
          ) : (
            <div className="space-y-2.5">
              {upcoming.map(
                (b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#FCE4EC] bg-[#FFFBFD] px-3 py-2.5"
                  >
                    <div className="min-w-0">

                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#1F191E] truncate">
                          {b.customer
                            ?.name ||
                            "-"}
                        </p>

                        <span className="hidden sm:inline text-[10px] font-mono text-[#A58D99]">
                          {b.booking_number ||
                            "-"}
                        </span>
                      </div>

                      <p className="text-xs text-[#7A6A75] mt-0.5">
                        {b.booking_number ||
                          "-"}
                        {" · "}
                        {formatDateShort(
                          b.start_date
                        )}{" "}
                        —{" "}
                        {formatDateShort(
                          b.end_date
                        )}
                      </p>
                    </div>

                    <StatusBadge
                      status={
                        b.status
                      }
                    />
                  </div>
                )
              )}
            </div>
          )}
        </SectionCard>

        {/* KIRIMAN */}
        <SectionCard
          title="📦 Status Kiriman"
          testid="dashboard-shipping-status"
        >
          {shippingDisplay.length ===
          0 ? (
            <EmptyState
              title="Tidak ada kiriman dekat"
            />
          ) : (
            <div className="space-y-2.5">
              {shippingDisplay.map(
                (b) => (
                  <ShippingRow
                    key={b.id}
                    booking={b}
                  />
                )
              )}
            </div>
          )}
        </SectionCard>

      </div>

      {/* ========================================================
          STATISTIK UTAMA LAMA
      ======================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <button type="button" onClick={() => navigate("/products")} className="dashboard-stat-button text-left">
        <StatCard
          testid="stat-total-kebaya"
          label="Total Kebaya"
          value={
            s.total_products ??
            0
          }
          sub={`${
            s.total_units ?? 0
          } unit fisik`}
          icon={Boxes}
          tone="pink"
        />
        </button>

        <button type="button" onClick={() => navigate("/products")} className="dashboard-stat-button text-left">
        <StatCard
          testid="stat-available"
          label="Tersedia"
          value={
            s.available_units ??
            0
          }
          icon={
            CheckCircle2
          }
          tone="green"
        />
        </button>

        <button type="button" onClick={() => navigate("/rental")} className="dashboard-stat-button text-left">
        <StatCard
          testid="stat-rented"
          label="Sedang Disewa"
          value={
            s.rented_units ??
            0
          }
          icon={Clock}
          tone="amber"
        />
        </button>

        <button type="button" onClick={() => navigate("/booking")} className="dashboard-stat-button text-left">
        <StatCard
          testid="stat-bookings-today"
          label="Booking Hari Ini"
          value={
            s.bookings_today ??
            0
          }
          sub={`${
            s.upcoming_bookings ??
            0
          } mendatang`}
          icon={
            CalendarCheck
          }
          tone="purple"
        />
        </button>

        <button type="button" onClick={() => navigate("/rental")} className="dashboard-stat-button text-left">
        <StatCard
          testid="stat-active-rentals"
          label="Rental Aktif"
          value={
            s.active_rentals ??
            0
          }
          sub={`${
            s.overdue_rentals ??
            0
          } terlambat`}
          icon={Clock}
          tone="blue"
        />
        </button>

        <button type="button" onClick={() => navigate("/reports")} className="dashboard-stat-button text-left">
        <StatCard
          testid="stat-revenue-today"
          label="Pendapatan Hari Ini"
          value={formatRupiah(
            s.revenue_today
          )}
          icon={
            TrendingUp
          }
          tone="green"
        />
        </button>

        <button type="button" onClick={() => navigate("/payments")} className="dashboard-stat-button text-left">
        <StatCard
          testid="stat-receivables"
          label="Piutang"
          value={formatRupiah(
            s.receivables
          )}
          icon={Wallet}
          tone="red"
        />
        </button>

        <button type="button" onClick={() => navigate("/reports")} className="dashboard-stat-button text-left">
        <StatCard
          testid="stat-revenue-month"
          label="Pendapatan Bulan Ini"
          value={formatRupiah(
            s.revenue_month
          )}
          icon={
            TrendingUp
          }
          tone="pink"
        />
        </button>

      </div>

      {/* ========================================================
          GRAFIK + PERHATIAN
      ======================================================== */}

      <div className="grid lg:grid-cols-3 gap-6">

        {/* GRAFIK */}
        <SectionCard
          title="Pendapatan 7 Hari Terakhir"
          className="lg:col-span-2"
          testid="revenue-chart"
        >
          <div className="h-56">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={chartData}
                margin={{
                  left: -10,
                  right: 8,
                  top: 8,
                }}
              >
                <defs>
                  <linearGradient
                    id="rev"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#E83E8C"
                      stopOpacity={
                        0.35
                      }
                    />

                    <stop
                      offset="100%"
                      stopColor="#E83E8C"
                      stopOpacity={
                        0
                      }
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#FCE4EC"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  tick={{
                    fontSize: 11,
                    fill: "#7A6A75",
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: "#7A6A75",
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000
                      ? `${
                          v / 1000
                        }k`
                      : v
                  }
                />

                <Tooltip
                  formatter={(v) =>
                    formatRupiah(v)
                  }
                  contentStyle={{
                    borderRadius: 12,
                    border:
                      "1px solid #F8D7E3",
                    fontSize: 12,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#E83E8C"
                  strokeWidth={
                    2.5
                  }
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* PERLU PERHATIAN */}
        <SectionCard
          title="Perlu Perhatian"
          testid="attention-card"
        >
          <div className="space-y-3">

            <AttentionRow
              icon={
                AlertTriangle
              }
              tone="red"
              label="Rental Terlambat"
              value={
                s.overdue_rentals ??
                0
              }
            />

            <AttentionRow
              icon={Wallet}
              tone="amber"
              label="Invoice Belum Lunas"
              value={formatRupiah(
                s.receivables
              )}
            />

            <button
              type="button"
              onClick={() => navigate("/products")}
              className="w-full text-left rounded-xl transition-all duration-200 hover:bg-[#FFF5F8] hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E83E8C]"
              aria-label="Lihat unit yang sedang dicuci di menu stok"
            >
              <AttentionRow
                icon={WashingMachine}
                tone="amber"
                label="Unit Sedang Dicuci"
                value={s.cleaning_units ?? 0}
              />
            </button>

            <button type="button" onClick={() => navigate("/customer-requests")} className="w-full text-left rounded-xl transition-all duration-200 hover:bg-[#FFF5F8] hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E83E8C]">
              <AttentionRow
                icon={ClipboardList}
                tone="pink"
                label="Customer Request menunggu"
                value={pendingCustomerRequests.length}
              />
            </button>

            <AttentionRow
              icon={Users}
              tone="pink"
              label="Total Pelanggan"
              value={
                s.total_customers ??
                0
              }
            />

          </div>
        </SectionCard>

      </div>

      {/* ========================================================
          BOTTOM OPERASIONAL
      ======================================================== */}

      <div className="grid lg:grid-cols-4 gap-6">

        {/* BOOKING */}
        <SectionCard
          title="Booking Mendatang"
          testid="upcoming-bookings"
        >
          {upcoming.length ===
          0 ? (
            <EmptyState
              title="Tidak ada booking"
            />
          ) : (
            <div className="space-y-2.5">

              {upcoming.map(
                (b) => (
                  <div
                    key={b.id}
                    className="text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">

                      <div className="min-w-0">

                        <p className="font-medium text-[#1F191E] truncate">
                          {b.customer
                            ?.name ||
                            "-"}
                        </p>

                        <p className="text-[10px] font-mono text-[#A58D99]">
                          {b.booking_number ||
                            "-"}
                        </p>

                        <p className="text-xs text-[#7A6A75]">
                          {formatDateShort(
                            b.start_date
                          )}{" "}
                          —{" "}
                          {formatDateShort(
                            b.end_date
                          )}
                        </p>

                      </div>

                      <StatusBadge
                        status={
                          b.status
                        }
                      />

                    </div>
                  </div>
                )
              )}

            </div>
          )}
        </SectionCard>

        {/* RENTAL KEMBALI */}
        <SectionCard
          title="Kebaya Akan Kembali"
          testid="due-rentals"
        >
          {dueRentalsDisplay.length ===
          0 ? (
            <EmptyState
              title="Tidak ada rental aktif"
            />
          ) : (
            <div className="space-y-2.5">

              {dueRentalsDisplay.map(
                (r) => (
                  <div
                    key={r.id}
                    className="text-sm"
                  >

                    <div className="flex items-start justify-between gap-2">

                      <div className="min-w-0">

                        <p className="font-medium text-[#1F191E] truncate">
                          {r.customer
                            ?.name ||
                            "-"}
                        </p>

                        <p className="text-[10px] font-mono text-[#A58D99]">
                          {r.booking_number ||
                            r.rental_number ||
                            "-"}
                        </p>

                        <p className="text-xs text-[#7A6A75]">
                          Kembali{" "}
                          {formatDateShort(
                            r.due_date
                          )}
                        </p>

                      </div>

                      <StatusBadge
                        status={
                          r.status
                        }
                      />

                    </div>

                  </div>
                )
              )}

            </div>
          )}
        </SectionCard>

        {/* PENGEMBALIAN PAKET */}
        <SectionCard
          title="Pengembalian Paket"
          testid="return-shipping"
        >
          {shippingDisplay.filter(
            (b) =>
              b.shippingType ===
              "RETURN"
          ).length === 0 ? (
            <EmptyState
              title="Tidak ada pengembalian dekat"
            />
          ) : (
            <div className="space-y-2.5">

              {shippingDisplay
                .filter(
                  (b) =>
                    b.shippingType ===
                    "RETURN"
                )
                .map(
                  (b) => (
                    <div
                      key={b.id}
                      className="text-sm"
                    >

                      <p className="font-medium text-[#1F191E] truncate">
                        {b.customer
                          ?.name ||
                          "-"}
                      </p>

                      <p className="text-[10px] font-mono text-[#A58D99]">
                        {b.booking_number ||
                          "-"}
                      </p>

                      <p className="text-xs text-[#B45309]">
                        Wajib kirim{" "}
                        {formatDateShort(
                          b.return_ship_date
                        )}
                      </p>

                    </div>
                  )
                )}

            </div>
          )}
        </SectionCard>

        {/* PEMBAYARAN */}
        <SectionCard
          title="Transaksi Terbaru"
          testid="recent-payments"
        >
          {recentPayments.length ===
          0 ? (
            <EmptyState
              title="Belum ada pembayaran"
            />
          ) : (
            <div className="space-y-2.5">

              {recentPayments.map(
                (p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >

                    <div className="min-w-0">

                      <p className="font-medium text-[#1F191E] truncate">
                        {p.customer
                          ?.name ||
                          p.payment_number}
                      </p>

                      <p className="text-xs text-[#7A6A75]">
                        {p.payment_method}{" "}
                        ·{" "}
                        {formatDateShort(
                          p.payment_date
                        )}
                      </p>

                    </div>

                    <span className="font-semibold text-[#047857]">
                      {formatRupiah(
                        p.amount
                      )}
                    </span>

                  </div>
                )
              )}

            </div>
          )}
        </SectionCard>

      </div>

    </div>
  );
}

/* ============================================================
   OPERATIONAL CARD
============================================================ */

function OperationalCard({
  testid,
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  onClick,
}) {
  const tones = {
    blue: {
      box: "border-[#D8EAFE] bg-[#F7FBFF]",
      icon: "bg-[#E0F2FE] text-[#0369A1]",
      value: "text-[#0369A1]",
    },

    amber: {
      box: "border-[#FDE7B2] bg-[#FFFCF4]",
      icon: "bg-[#FEF3C7] text-[#B45309]",
      value: "text-[#B45309]",
    },

    green: {
      box: "border-[#D1FAE5] bg-[#F7FFFB]",
      icon: "bg-[#DCFCE7] text-[#047857]",
      value: "text-[#047857]",
    },

    pink: {
      box: "border-[#F8D7E3] bg-[#FFF9FC]",
      icon: "bg-[#FFF0F6] text-[#E83E8C]",
      value: "text-[#E83E8C]",
    },
  };

  const t =
    tones[tone] ||
    tones.pink;

  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={`group w-full text-left rounded-2xl border p-4 shadow-sm ${t.box} transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E83E8C] motion-safe:animate-[dashboardIn_450ms_ease-out_both]`}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="flex items-start justify-between gap-3">

        <div>
          <p className="text-xs font-medium text-[#7A6A75]">
            {title}
          </p>

          <p
            className={`text-3xl font-bold mt-1 ${t.value} transition-transform duration-300 group-hover:scale-105 origin-left`}
          >
            {value}
          </p>

          <p className="text-[11px] text-[#A58D99] mt-1">
            {subtitle}
          </p>
        </div>

        <div
          className={`h-10 w-10 rounded-xl grid place-items-center ${t.icon}`}
        >
          <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" />
        </div>

      </div>
      <span className="sr-only">Buka menu {title}</span>
    </button>
  );
}

/* ============================================================
   SHIPPING ROW
============================================================ */

function ShippingRow({
  booking,
}) {
  const isReturn =
    booking.shippingType ===
    "RETURN";

  const date =
    isReturn
      ? booking.return_ship_date
      : booking.shipping_date;

  const days =
    date
      ? diffDays(
          isoToday(),
          date
        )
      : null;

  let label = "";

  if (days === 0) {
    label = isReturn
      ? "WAJIB KIRIM HARI INI"
      : "KIRIM HARI INI";
  } else if (days === 1) {
    label = isReturn
      ? "WAJIB KIRIM BESOK"
      : "KIRIM BESOK";
  } else {
    label = isReturn
      ? `WAJIB KIRIM H-${days}`
      : `KIRIM H-${days}`;
  }

  return (
    <div className="rounded-xl border border-[#FCE4EC] bg-[#FFFBFD] p-3">

      <div className="flex items-start gap-3">

        <div className="h-9 w-9 rounded-lg bg-[#FFF0F6] text-[#E83E8C] grid place-items-center shrink-0">
          {isReturn ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Truck className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-center justify-between gap-2">

            <p className="font-semibold text-sm text-[#1F191E] truncate">
              {booking.customer
                ?.name ||
                "-"}
            </p>

            <span
              className={`text-[9px] font-bold rounded-full px-2 py-1 shrink-0 ${
                isReturn
                  ? "bg-[#FEF3C7] text-[#B45309]"
                  : "bg-[#E0F2FE] text-[#0369A1]"
              }`}
            >
              {label}
            </span>

          </div>

          <p className="text-[10px] font-mono text-[#A58D99] mt-0.5">
            {booking.booking_number ||
              "-"}
          </p>

          <p className="text-xs text-[#7A6A75] mt-1">
            {isReturn
              ? `Wajib kirim kembali ${formatDateShort(
                  date
                )}`
              : `Tanggal kirim ${formatDateShort(
                  date
                )}`}
          </p>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   ATTENTION ROW
============================================================ */

function AttentionRow({
  icon: Icon,
  tone,
  label,
  value,
}) {
  const tones = {
    red:
      "bg-[#FEF2F2] text-[#B91C1C]",

    amber:
      "bg-[#FEF3C7] text-[#B45309]",

    blue:
      "bg-[#E0F2FE] text-[#0369A1]",

    pink:
      "bg-[#FFF5F8] text-[#E83E8C]",
  };

  return (
    <div className="flex items-center gap-3">

      <div
        className={`h-9 w-9 rounded-lg grid place-items-center ${tones[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <p className="text-sm text-[#4A3F47] flex-1">
        {label}
      </p>

      <p className="font-semibold text-[#1F191E]">
        {value}
      </p>

    </div>
  );
}
