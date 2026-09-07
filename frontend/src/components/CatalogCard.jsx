import { formatRupiah } from "@/lib/format";
import { availabilityStatus } from "@/lib/availability";
import { Btn } from "@/components/form";
import { StatusBadge } from "@/components/common";
import { cn } from "@/lib/utils";
import { CalendarSearch, CalendarDays, Pencil, Trash2, Boxes } from "lucide-react";

/**
 * Kartu produk katalog dengan info ketersediaan.
 * Dipakai oleh Katalog (internal) dan /sewa (publik).
 */
export default function CatalogCard({ product: p, avail, checking, canManage, onCheck, onSchedule, onEdit, onDelete, publicMode }) {
  const st = availabilityStatus(avail);
  const total = avail ? Number(avail.total) : Number(p.total_units ?? 0);
  const categoryName = p.category?.name || p.category_name || "—";

  return (
    <div className="bg-white border border-[#F8D7E3] rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(232,62,140,0.04)] hover:shadow-[0_4px_20px_rgba(232,62,140,0.1)] transition-all group flex flex-col" data-testid={`product-card-${p.id}`}>
      <div className="aspect-[4/5] bg-[#FFF5F8] overflow-hidden relative">
        {p.photo_url ? (
          <img src={p.photo_url} alt={p.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="h-full w-full grid place-items-center text-[#E0A8C0] text-sm">Tanpa Foto</div>
        )}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm", st.tone)} data-testid={`availability-badge-${p.id}`}>
            {st.label}
          </span>
          {!publicMode && p.status === "INACTIVE" && <StatusBadge status="INACTIVE" />}
        </div>
        <div className="absolute bottom-3 right-3 rounded-lg bg-white/90 backdrop-blur px-2 py-1 text-[11px] font-semibold text-[#1F191E] inline-flex items-center gap-1 shadow-sm" data-testid={`units-summary-${p.id}`}>
          <Boxes className="h-3.5 w-3.5 text-[#E83E8C]" />
          {avail ? `${avail.available}/${total} unit` : `${total} unit`}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <p className="text-[11px] text-[#B79BAA] font-medium">{categoryName} · {p.product_code || "—"}</p>
        <h3 className="font-semibold text-[#1F191E] mt-0.5 truncate" title={p.name}>{p.name}</h3>
        <p className="text-[#E83E8C] font-bold mt-1">{formatRupiah(p.rental_price)} <span className="text-xs font-normal text-[#7A6A75]">/sewa</span></p>

        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-[#FAF7F8] px-2.5 py-1.5">
            <p className="text-[#7A6A75]">Total unit</p>
            <p className="font-semibold text-[#1F191E]" data-testid={`total-units-${p.id}`}>{total}</p>
          </div>
          <div className={cn("rounded-lg px-2.5 py-1.5", avail ? (Number(avail.available) > 0 ? "bg-[#ECFDF5]" : "bg-[#FEF2F2]") : "bg-[#FAF7F8]")}>
            <p className="text-[#7A6A75]">Tersedia</p>
            <p className={cn("font-semibold", avail ? (Number(avail.available) > 0 ? "text-[#047857]" : "text-[#B91C1C]") : "text-[#1F191E]")} data-testid={`available-units-${p.id}`}>
              {avail ? avail.available : "—"}
            </p>
          </div>
        </div>

        {avail && (
          <p className={cn("mt-2 text-xs font-medium", Number(avail.available) > 0 ? "text-[#047857]" : "text-[#B91C1C]")} data-testid={`availability-${p.id}`}>
            {Number(avail.available) > 0 ? `✓ Tersedia ${avail.available} dari ${total} unit` : "✕ Tidak tersedia untuk tanggal tersebut"}
          </p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn variant="secondary" className="py-1.5 px-2 text-xs" onClick={() => onCheck?.(p)} loading={checking} data-testid={`check-availability-${p.id}`}>
            <CalendarSearch className="h-3.5 w-3.5" /> Cek Ketersediaan
          </Btn>
          <Btn variant="outline" className="py-1.5 px-2 text-xs" onClick={() => onSchedule?.(p)} data-testid={`view-schedule-${p.id}`}>
            <CalendarDays className="h-3.5 w-3.5" /> Lihat Jadwal
          </Btn>
        </div>

        {canManage && !publicMode && (
          <div className="mt-2 flex gap-2">
            <Btn variant="ghost" className="flex-1 py-1.5 text-xs" onClick={() => onEdit?.(p)} data-testid={`product-edit-${p.id}`}><Pencil className="h-3.5 w-3.5" /> Edit</Btn>
            <Btn variant="ghost" className="px-2.5 py-1.5 text-[#B91C1C]" onClick={() => onDelete?.(p)} data-testid={`product-delete-${p.id}`}><Trash2 className="h-4 w-4" /></Btn>
          </div>
        )}
      </div>
    </div>
  );
}
