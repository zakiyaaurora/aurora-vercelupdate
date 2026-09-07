import { useEffect, useMemo, useState } from "react";
import { productSchedule, checkAvailability } from "@/lib/api";
import { formatDateShort } from "@/lib/format";
import {
  availabilityStatus, availabilityText, buildMonthGrid, busyUnitsOn, inRange,
  monthStartISO, monthEndISO, monthLabel,
} from "@/lib/availability";
import { Modal, Btn } from "@/components/form";
import { StatusBadge, Loading, ErrorState } from "@/components/common";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays, Phone, Lock } from "lucide-react";

const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/**
 * Modal "Lihat Jadwal" — kalender bulanan + jadwal per unit/SKU.
 * Data berasal dari RPC product_schedule (nama penyewa otomatis disamarkan
 * oleh server bila pemanggil belum login).
 */
export default function ScheduleModal({ product, open, onClose, startDate, endDate }) {
  const initial = startDate ? new Date(startDate) : new Date();
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [data, setData] = useState(null);
  const [rangeAvail, setRangeAvail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [focusDay, setFocusDay] = useState(null);

  useEffect(() => {
    if (!open || !product?.id) return;
    const d = startDate ? new Date(startDate) : new Date();
    setYear(d.getFullYear()); setMonth(d.getMonth()); setFocusDay(null);
  }, [open, product?.id, startDate]);

  useEffect(() => {
    if (!open || !product?.id) return;
    let alive = true;
    setLoading(true); setError(null);
    productSchedule(product.id, monthStartISO(year, month), monthEndISO(year, month))
      .then((res) => { if (alive) setData(res); })
      .catch((e) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, product?.id, year, month]);

  useEffect(() => {
    if (!open || !product?.id || !startDate || !endDate) { setRangeAvail(null); return; }
    let alive = true;
    checkAvailability(product.id, startDate, endDate).then((a) => { if (alive) setRangeAvail(a); }).catch(() => {});
    return () => { alive = false; };
  }, [open, product?.id, startDate, endDate]);

  const units = useMemo(() => data?.units || [], [data]);
  const total = units.length;
  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const internal = Boolean(data?.internal);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); setFocusDay(null); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); setFocusDay(null); };

  const listedUnits = useMemo(() => {
    if (!focusDay) return units;
    return units.map((u) => ({ ...u, occupancies: (u.occupancies || []).filter((o) => inRange(focusDay, o.start_date, o.end_date)) }));
  }, [units, focusDay]);

  const st = availabilityStatus(rangeAvail);

  return (
    <Modal open={open} onClose={onClose} size="xl"
      title={<span className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#E83E8C]" /> Jadwal — {product?.name || ""}</span>}
      footer={<Btn variant="outline" onClick={onClose} data-testid="schedule-close-btn">Tutup</Btn>}>
      <div data-testid="schedule-modal">
        {/* Ringkasan rentang tanggal yang dipilih */}
        {startDate && endDate && (
          <div className={cn("rounded-xl border px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-2", st.tone)} data-testid="schedule-range-summary">
            <p className="text-sm">
              <span className="font-semibold">{formatDateShort(startDate)} – {formatDateShort(endDate)}</span>
              <span className="mx-2">·</span>
              <span data-testid="schedule-range-availability">{rangeAvail ? availabilityText(rangeAvail) : "Menghitung…"}</span>
            </p>
            <span className="text-xs font-bold uppercase tracking-wide">{st.label}</span>
          </div>
        )}

        {!internal && (
          <p className="mb-3 text-xs text-[#7A6A75] flex items-center gap-1.5" data-testid="schedule-public-notice">
            <Lock className="h-3.5 w-3.5" /> Tampilan publik — identitas penyewa disamarkan.
          </p>
        )}

        <div className="grid lg:grid-cols-12 gap-5">
          {/* Kalender */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="h-8 w-8 rounded-lg grid place-items-center text-[#E83E8C] hover:bg-[#FFF5F8]" data-testid="schedule-prev-month"><ChevronLeft className="h-4 w-4" /></button>
              <p className="font-semibold text-[#1F191E] capitalize" data-testid="schedule-month-label">{monthLabel(year, month)}</p>
              <button onClick={nextMonth} className="h-8 w-8 rounded-lg grid place-items-center text-[#E83E8C] hover:bg-[#FFF5F8]" data-testid="schedule-next-month"><ChevronRight className="h-4 w-4" /></button>
            </div>

            {loading && !data ? <Loading label="Memuat jadwal…" /> : error ? <ErrorState error={error} /> : (
              <div className={cn("transition-opacity", loading && "opacity-60")}>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS.map((d) => <div key={d} className="text-center text-[11px] font-semibold text-[#B79BAA] uppercase">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1" data-testid="schedule-calendar">
                  {weeks.flat().map((c) => {
                    const busy = c.inMonth ? busyUnitsOn(units, c.iso) : 0;
                    const full = total > 0 && busy >= total;
                    const partial = busy > 0 && !full;
                    const selected = inRange(c.iso, startDate, endDate);
                    return (
                      <button key={c.iso} type="button" onClick={() => c.inMonth && setFocusDay((f) => (f === c.iso ? null : c.iso))}
                        title={c.inMonth ? `${formatDateShort(c.iso)}: ${busy} dari ${total} unit terpakai` : ""}
                        data-testid={c.inMonth ? `cal-day-${c.iso}` : undefined}
                        data-busy={c.inMonth ? busy : undefined}
                        className={cn(
                          "relative aspect-square rounded-lg border text-xs flex flex-col items-center justify-center transition-all",
                          !c.inMonth && "opacity-30 border-transparent",
                          c.inMonth && !busy && "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]",
                          c.inMonth && partial && "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]",
                          c.inMonth && full && "bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]",
                          selected && c.inMonth && "ring-2 ring-[#E83E8C] ring-offset-1",
                          focusDay === c.iso && "outline outline-2 outline-[#1F191E]"
                        )}>
                        <span className="font-semibold">{c.day}</span>
                        {c.inMonth && total > 0 && <span className="text-[9px] leading-none mt-0.5">{total - busy}/{total}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#7A6A75]">
                  <Legend cls="bg-[#ECFDF5] border-[#A7F3D0]" label="Tersedia" />
                  <Legend cls="bg-[#FEF3C7] border-[#FDE68A]" label="Sebagian terpakai" />
                  <Legend cls="bg-[#FEF2F2] border-[#FECACA]" label="Penuh" />
                  <Legend cls="border-[#E83E8C] ring-1 ring-[#E83E8C]" label="Tanggal dipilih" />
                  <span className="ml-auto">Angka = unit tersedia / total</span>
                </div>
              </div>
            )}
          </div>

          {/* Jadwal per unit */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[#1F191E]">Jadwal per Unit ({total})</p>
              {focusDay && (
                <button onClick={() => setFocusDay(null)} className="text-xs text-[#E83E8C] hover:underline" data-testid="schedule-clear-focus">
                  {formatDateShort(focusDay)} ✕
                </button>
              )}
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1" data-testid="schedule-units">
              {listedUnits.length === 0 && <p className="text-sm text-[#7A6A75]">Belum ada unit fisik untuk produk ini.</p>}
              {listedUnits.map((u) => (
                <div key={u.id} className="rounded-xl border border-[#FCE4EC] bg-[#FEFCFD] p-3" data-testid={`schedule-unit-${u.sku}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#1F191E]">{u.sku}</span>
                    <StatusBadge status={u.status} />
                    {internal && u.location && <span className="text-[11px] text-[#7A6A75]">· {u.location}</span>}
                  </div>
                  {(u.occupancies || []).length === 0 ? (
                    <p className="mt-1.5 text-xs text-[#047857]">
                      {u.status === "MAINTENANCE" ? "Sedang perawatan" : focusDay ? "Tersedia pada tanggal ini" : "Tidak ada jadwal bulan ini — tersedia"}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {u.occupancies.map((o) => (
                        <li key={`${o.kind}-${o.ref_id}`} className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1" data-testid={`occupancy-${o.kind}-${u.sku}`}>
                          <span className={cn("rounded-full border px-2 py-0.5 font-semibold",
                            o.kind === "RENTAL" ? "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]" : "bg-[#F3E8FF] text-[#6D28D9] border-[#DDD6FE]")}>
                            {o.kind === "RENTAL" ? "Disewa" : "Dipesan"}{internal ? ` · ${o.status}` : ""}
                          </span>
                          <span className="text-[#4A3F47]">{formatDateShort(o.start_date)} – {formatDateShort(o.end_date)}</span>
                          <span className="font-medium text-[#1F191E]" data-testid="occupancy-customer">{o.customer_name}</span>
                          {o.ref_number && <span className="font-mono text-[#7A6A75]">{o.ref_number}</span>}
                          {o.customer_phone && <span className="inline-flex items-center gap-1 text-[#7A6A75]"><Phone className="h-3 w-3" />{o.customer_phone}</span>}
                          {o.is_overdue && <span className="rounded-full bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] px-2 py-0.5 font-semibold">Terlambat</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Legend({ cls, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded border", cls)} /> {label}
    </span>
  );
}
