export const formatRupiah = (value) => {
  const n = Number(value || 0);
  return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
};

export const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
};

export const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

export const formatDateShort = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDays = (isoDate, days) => {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (a, b) => {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
};
