import { checkAvailability } from "./api";

/**
 * Ringkasan status ketersediaan dari hasil RPC { total, busy, available }.
 */
export function availabilityStatus(a) {
  if (!a) return { key: "UNKNOWN", label: "Belum dicek", tone: "bg-gray-100 text-gray-500 border-gray-200" };
  const total = Number(a.total || 0);
  const available = Number(a.available || 0);
  if (total === 0) return { key: "NO_STOCK", label: "Belum ada unit", tone: "bg-gray-100 text-gray-500 border-gray-200" };
  if (available <= 0) return { key: "UNAVAILABLE", label: "Tidak tersedia", tone: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]" };
  if (available < total) return { key: "PARTIAL", label: "Tersedia sebagian", tone: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]" };
  return { key: "AVAILABLE", label: "Tersedia", tone: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" };
}

export const availabilityText = (a) => {
  if (!a) return "";
  if (Number(a.total || 0) === 0) return "Belum ada unit fisik";
  if (Number(a.available || 0) <= 0) return "Tidak tersedia untuk tanggal tersebut";
  return `Tersedia ${a.available} dari ${a.total} unit`;
};

/**
 * Parse pesan error RPC create_booking: "not_available:<product_id>:<available>"
 * Mengembalikan pesan ramah dalam Bahasa Indonesia.
 */
export function parseNotAvailable(message, products = []) {
  const msg = String(message || "");
  const m = msg.match(/not_available:([0-9a-f-]+)(?::(\d+))?/i);
  if (!m) return null;
  const p = products.find((x) => x.id === m[1]);
  const name = p?.name || "Produk";
  if (m[2] !== undefined) {
    const n = Number(m[2]);
    return n > 0
      ? `${name}: hanya tersedia ${n} unit pada tanggal tersebut.`
      : `${name}: tidak tersedia untuk tanggal tersebut.`;
  }
  return `${name}: tidak tersedia pada tanggal tersebut.`;
}

/**
 * Pre-check ketersediaan sebelum booking/POS.
 * items: [{ product_id, quantity }]. Mengembalikan daftar masalah (kosong = aman).
 */
export async function precheckItems(items, startDate, endDate, products = []) {
  const grouped = {};
  items.forEach((it) => {
    grouped[it.product_id] = (grouped[it.product_id] || 0) + Number(it.quantity || 1);
  });
  const problems = [];
  await Promise.all(Object.entries(grouped).map(async ([pid, qty]) => {
    const a = await checkAvailability(pid, startDate, endDate);
    if (Number(a?.available || 0) < qty) {
      const p = products.find((x) => x.id === pid);
      problems.push({
        product_id: pid,
        name: p?.name || "Produk",
        requested: qty,
        available: Number(a?.available || 0),
        total: Number(a?.total || 0),
        message: Number(a?.available || 0) > 0
          ? `${p?.name || "Produk"}: diminta ${qty} unit, hanya tersedia ${a.available} dari ${a.total} unit.`
          : `${p?.name || "Produk"}: tidak tersedia untuk tanggal tersebut.`,
      });
    }
  }));
  return problems;
}

/* ----------------------------- Kalender ----------------------------- */
const pad = (n) => String(n).padStart(2, "0");
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthStartISO = (year, month) => toISODate(new Date(year, month, 1));
export const monthEndISO = (year, month) => toISODate(new Date(year, month + 1, 0));
export const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

/** true jika tanggal ISO `d` berada di dalam [start, end] (inklusif) */
export const inRange = (d, start, end) => Boolean(start && end && d >= start && d <= end);

/**
 * Bangun grid kalender (array minggu, tiap minggu 7 sel) untuk bulan tertentu.
 * Sel: { iso, day, inMonth }
 */
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Senin = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) {
    const d = new Date(year, month, 1 - (offset - i));
    cells.push({ iso: toISODate(d), day: d.getDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ iso: toISODate(new Date(year, month, day)), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = new Date(cells[cells.length - 1].iso);
    last.setDate(last.getDate() + 1);
    cells.push({ iso: toISODate(last), day: last.getDate(), inMonth: false });
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Hitung jumlah unit yang terpakai pada tanggal ISO `d` dari data product_schedule */
export function busyUnitsOn(units = [], d) {
  return units.filter((u) =>
    u.status === "MAINTENANCE" ||
    (u.occupancies || []).some((o) => inRange(d, o.start_date, o.end_date))
  ).length;
}
