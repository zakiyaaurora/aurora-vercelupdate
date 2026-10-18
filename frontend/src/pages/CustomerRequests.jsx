
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  ClipboardList,
  Clock3,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  CalendarDays,
  MapPin,
  Phone,
  Mail,
  UserRound,
  Package,
  Truck,
  Scissors,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCustomerRequests,
  processCustomerRequest,
} from "../lib/api";

const PINK = "#E83E8C";

const STATUS = {
  PENDING: {
    label: "Menunggu",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  APPROVED: {
    label: "Disetujui",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  REJECTED: {
    label: "Ditolak",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${value}`.slice(0, 10) + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatMethod = (value) => {
  const methods = {
    PICKUP: "Ambil sendiri",
    DELIVERY: "Pengiriman",
    OFFLINE: "Fitting langsung",
    ONLINE: "Konsultasi online",
    UNDECIDED: "Belum ditentukan",
  };
  return methods[value] || value || "-";
};

const normalize = (value) =>
  String(value || "").toLowerCase().trim();

function StatusBadge({ status }) {
  const item = STATUS[status] || STATUS.PENDING;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="mt-0.5 rounded-xl bg-pink-50 p-2 text-pink-600">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-gray-800">
          {value || "-"}
        </p>
      </div>
    </div>
  );
}

export default function CustomerRequests() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getCustomerRequests(
        statusFilter === "ALL" ? null : statusFilter
      );

      const rows = Array.isArray(result) ? result : [];
      setRequests(rows);

      setSelected((current) =>
        current
          ? rows.find((row) => row.id === current.id) || null
          : null
      );
    } catch (err) {
      console.error("Gagal memuat Customer Request:", err);
      setError(
        err?.message ||
          "Data pengajuan belum bisa dimuat. Periksa koneksi dan akses akun."
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const counts = useMemo(() => {
    const result = { ALL: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };

    requests.forEach((request) => {
      result.ALL += 1;
      if (result[request.status] !== undefined) {
        result[request.status] += 1;
      }
    });

    return result;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const query = normalize(search);

    return requests.filter((request) => {
      if (!query) return true;

      return [
        request.name,
        request.phone,
        request.whatsapp,
        request.email,
        request.product_name,
        request.address,
        request.city,
        request.province,
        request.postal_code,
      ].some((value) => normalize(value).includes(query));
    });
  }, [requests, search]);

  const handleProcess = async (request, action) => {
    if (!request?.id || processingId) return;

    let rejectionReason = null;

    if (action === "REJECT") {
      rejectionReason = window.prompt(
        "Masukkan alasan penolakan (opsional):"
      );

      if (rejectionReason === null) return;

      if (rejectionReason.trim().length > 1000) {
        toast.error("Alasan maksimal 1000 karakter.");
        return;
      }

      if (
        !window.confirm(
          `Tolak pengajuan dari ${request.name}?`
        )
      ) {
        return;
      }
    } else {
      if (
        !window.confirm(
          `Setujui pengajuan dari ${request.name}?\n\n` +
            "Persetujuan ini akan menghubungkan atau membuat data pelanggan. " +
            "Booking dan stok tidak akan berubah."
        )
      ) {
        return;
      }
    }

    setProcessingId(request.id);

    try {
      await processCustomerRequest(
        request.id,
        action,
        rejectionReason?.trim() || null
      );

      toast.success(
        action === "APPROVE"
          ? "Pengajuan berhasil disetujui."
          : "Pengajuan berhasil ditolak."
      );

      setSelected(null);
      await loadRequests();
    } catch (err) {
      console.error("Gagal memproses pengajuan:", err);
      toast.error(
        err?.message || "Pengajuan gagal diproses."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const statCards = [
    {
      key: "ALL",
      label: "Semua Pengajuan",
      value: counts.ALL,
      icon: ClipboardList,
      color: "text-pink-600",
      bg: "bg-pink-50",
    },
    {
      key: "PENDING",
      label: "Menunggu",
      value: counts.PENDING,
      icon: Clock3,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      key: "APPROVED",
      label: "Disetujui",
      value: counts.APPROVED,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      key: "REJECTED",
      label: "Ditolak",
      value: counts.REJECTED,
      icon: XCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFFAFC] p-4 text-[#1F191E] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-pink-600">
              <span className="h-2 w-2 rounded-full bg-pink-500" />
              AURORA SEWA KEBAYA
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Customer Request
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Kelola pengajuan sewa kebaya dari calon pelanggan.
            </p>
          </div>

          <button
            type="button"
            onClick={loadRequests}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-pink-200 bg-white px-4 py-2.5 text-sm font-semibold text-pink-600 shadow-sm transition hover:bg-pink-50 disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Muat Ulang
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            const active = statusFilter === card.key;

            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setStatusFilter(card.key)}
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
                  active
                    ? "border-pink-300 ring-2 ring-pink-100"
                    : "border-pink-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-500 sm:text-sm">
                    {card.label}
                  </span>
                  <span className={`rounded-xl p-2 ${card.bg} ${card.color}`}>
                    <Icon size={19} />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-bold sm:text-3xl">
                  {card.value}
                </p>
              </button>
            );
          })}
        </div>

        {/* Main panel */}
        <section className="overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-pink-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold">Daftar Pengajuan</h2>
              <p className="mt-1 text-sm text-gray-500">
                Periksa detail sebelum menyetujui pengajuan.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, WhatsApp, atau kebaya..."
                className="w-full rounded-xl border border-gray-200 bg-[#FFFCFD] py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              />
            </div>
          </div>

          {/* Status filters */}
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-4 py-3 sm:px-5">
            {[
              ["ALL", "Semua"],
              ["PENDING", "Menunggu"],
              ["APPROVED", "Disetujui"],
              ["REJECTED", "Ditolak"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  statusFilter === value
                    ? "bg-pink-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-pink-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="m-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Gagal memuat pengajuan</p>
                <p className="mt-1 break-words">{error}</p>
                <button
                  type="button"
                  onClick={loadRequests}
                  className="mt-2 font-semibold underline"
                >
                  Coba lagi
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-gray-500">
              <LoaderCircle
                size={30}
                className="animate-spin text-pink-500"
              />
              <p className="text-sm">Memuat pengajuan...</p>
            </div>
          ) : !error && filteredRequests.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="rounded-2xl bg-pink-50 p-4 text-pink-500">
                <ClipboardList size={30} />
              </div>
              <h3 className="mt-4 font-semibold">
                {search
                  ? "Pengajuan tidak ditemukan"
                  : "Belum ada pengajuan"}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                {search
                  ? "Coba kata kunci lain."
                  : "Pengajuan dari formulir pelanggan akan muncul di sini."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="divide-y divide-pink-50 md:hidden">
                {filteredRequests.map((request) => (
                  <div key={request.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold">
                          {request.name}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {request.whatsapp || request.phone || "-"}
                        </p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>

                    <div className="rounded-xl bg-[#FFFAFC] p-3">
                      <p className="text-xs text-gray-500">Kebaya pilihan</p>
                      <p className="mt-1 text-sm font-semibold">
                        {request.product_name || "Produk tidak tersedia"}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        {formatDate(request.rental_start_date)} –{" "}
                        {formatDate(request.rental_end_date)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">
                        Diajukan {formatDateTime(request.created_at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelected(request)}
                        className="inline-flex items-center gap-2 rounded-lg border border-pink-200 px-3 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50"
                      >
                        <Eye size={15} />
                        Detail
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-[#FFFAFC] text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Pelanggan</th>
                      <th className="px-5 py-4 font-semibold">Kebaya</th>
                      <th className="px-5 py-4 font-semibold">Periode Sewa</th>
                      <th className="px-5 py-4 font-semibold">Diajukan</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 text-right font-semibold">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRequests.map((request) => (
                      <tr
                        key={request.id}
                        className="transition hover:bg-[#FFFAFC]"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold">{request.name}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {request.whatsapp || request.phone || "-"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-medium">
                            {request.product_name || "Produk tidak tersedia"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          <p>{formatDate(request.rental_start_date)}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            s.d. {formatDate(request.rental_end_date)}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-gray-500">
                          {formatDateTime(request.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={request.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelected(request)}
                            className="inline-flex items-center gap-2 rounded-lg border border-pink-200 px-3 py-2 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
                          >
                            <Eye size={15} />
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 sm:px-5">
                Menampilkan {filteredRequests.length} pengajuan
              </div>
            </>
          )}
        </section>
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-detail-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-pink-100 bg-white p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">
                  Detail Customer Request
                </p>
                <h2
                  id="request-detail-title"
                  className="mt-2 text-xl font-bold"
                >
                  {selected.name}
                </h2>
                <div className="mt-2">
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Tutup detail"
                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div>
                <h3 className="mb-4 text-sm font-bold">
                  Informasi Pelanggan
                </h3>
                <div className="grid gap-5 sm:grid-cols-2">
                  <InfoItem
                    icon={UserRound}
                    label="Nama"
                    value={selected.name}
                  />
                  <InfoItem
                    icon={Phone}
                    label="WhatsApp"
                    value={selected.whatsapp || selected.phone}
                  />
                  <InfoItem
                    icon={Mail}
                    label="Email"
                    value={selected.email}
                  />
                  <InfoItem
                    icon={MapPin}
                    label="Alamat Jalan"
                    value={selected.address}
                  />
                  <InfoItem
                    icon={MapPin}
                    label="Kota/Kabupaten"
                    value={selected.city}
                  />
                  <InfoItem
                    icon={MapPin}
                    label="Provinsi"
                    value={selected.province}
                  />
                  <InfoItem
                    icon={MapPin}
                    label="Kode Pos"
                    value={selected.postal_code}
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <h3 className="mb-4 text-sm font-bold">
                  Informasi Sewa
                </h3>
                <div className="grid gap-5 sm:grid-cols-2">
                  <InfoItem
                    icon={Package}
                    label="Kebaya pilihan"
                    value={selected.product_name || "Produk tidak tersedia"}
                  />
                  <InfoItem
                    icon={CalendarDays}
                    label="Tanggal mulai sewa"
                    value={formatDate(selected.rental_start_date)}
                  />
                  <InfoItem
                    icon={CalendarDays}
                    label="Tanggal akhir sewa"
                    value={formatDate(selected.rental_end_date)}
                  />
                  <InfoItem
                    icon={CalendarDays}
                    label="Tanggal acara"
                    value={formatDate(selected.event_date)}
                  />
                  <InfoItem
                    icon={Truck}
                    label="Metode pengambilan"
                    value={formatMethod(selected.fulfillment_method)}
                  />
                  <InfoItem
                    icon={Scissors}
                    label="Metode fitting"
                    value={formatMethod(selected.fitting_method)}
                  />
                  <InfoItem
                    icon={CalendarDays}
                    label="Tanggal fitting"
                    value={formatDate(selected.fitting_date)}
                  />
                  <InfoItem
                    icon={Clock3}
                    label="Jam fitting"
                    value={selected.fitting_time}
                  />
                </div>

                {selected.notes && (
                  <div className="mt-5 rounded-xl bg-[#FFFAFC] p-4">
                    <p className="text-xs font-semibold text-gray-500">
                      Catatan pelanggan
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                      {selected.notes}
                    </p>
                  </div>
                )}

                <p className="mt-4 text-xs text-gray-400">
                  Diajukan pada {formatDateTime(selected.created_at)}
                </p>

                {selected.rejection_reason && (
                  <div className="mt-4 rounded-xl bg-rose-50 p-4">
                    <p className="text-xs font-semibold text-rose-700">
                      Alasan penolakan
                    </p>
                    <p className="mt-1 text-sm text-rose-700">
                      {selected.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {selected.status === "PENDING" && (
              <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-pink-100 bg-white p-5 sm:flex-row sm:justify-end sm:p-6">
                <button
                  type="button"
                  disabled={processingId === selected.id}
                  onClick={() => handleProcess(selected, "REJECT")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-5 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  {processingId === selected.id ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <XCircle size={17} />
                  )}
                  Tolak Pengajuan
                </button>
                <button
                  type="button"
                  disabled={processingId === selected.id}
                  onClick={() => handleProcess(selected, "APPROVE")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-600 disabled:opacity-50"
                >
                  {processingId === selected.id ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  Setujui Pengajuan
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
