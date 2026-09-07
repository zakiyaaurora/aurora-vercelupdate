import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import { listRentals, getRental, returnRental } from "@/lib/api";
import { formatRupiah, formatDateShort, todayISO, daysBetween } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState, StatusBadge } from "@/components/common";
import { Field, TextInput, TextArea, NativeSelect, Btn, Modal, SearchInput, Table, Th, Td } from "@/components/form";
import { PackageOpen, Eye } from "lucide-react";
import { toast } from "sonner";

export default function Rental() {
  const { data, loading, error, reload } = useAsync(listRentals, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ret, setRet] = useState({ actual_return_date: todayISO(), late_fee: 0, notes: "", items: [] });

  const rentals = useMemo(() => data || [], [data]);
  const filtered = useMemo(() => rentals.filter((r) => {
    const okS = !search || (r.rental_number || "").toLowerCase().includes(search.toLowerCase()) || (r.customer?.name || "").toLowerCase().includes(search.toLowerCase());
    const okF = !statusFilter || r.status === statusFilter;
    return okS && okF;
  }), [rentals, search, statusFilter]);

  const isOverdue = (r) => ["OUT", "ACTIVE"].includes(r.status) && r.due_date < todayISO() && !r.actual_return_date;

  const viewDetail = async (r) => { try { setDetail(await getRental(r.id)); } catch (e) { toast.error(e.message); } };

  const openReturn = async (r) => {
    try {
      const full = await getRental(r.id);
      const lateDays = daysBetween(full.due_date, todayISO());
      setRet({
        actual_return_date: todayISO(),
        late_fee: 0,
        _lateDays: lateDays,
        notes: "",
        rental_number: full.rental_number,
        items: (full.items || []).map((it) => ({
          rental_item_id: it.id, inventory_item_id: it.inventory_item_id,
          product_name: it.product?.name, sku: it.inventory?.sku,
          condition_return: "GOOD", inventory_status: "AVAILABLE", damage_fee: 0, lost_fee: 0, notes: "",
        })),
      });
      setReturnModal(r.id);
    } catch (e) { toast.error(e.message); }
  };

  const updateRetItem = (idx, patch) => setRet((s) => ({ ...s, items: s.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));

  const submitReturn = async () => {
    setSaving(true);
    try {
      await returnRental({
        rental_id: returnModal,
        actual_return_date: ret.actual_return_date,
        late_fee: Number(ret.late_fee || 0),
        notes: ret.notes,
        items: ret.items.map((it) => ({
          rental_item_id: it.rental_item_id, inventory_item_id: it.inventory_item_id,
          condition_return: it.condition_return, inventory_status: it.inventory_status,
          damage_fee: Number(it.damage_fee || 0), lost_fee: Number(it.lost_fee || 0), notes: it.notes,
        })),
      });
      toast.success("Pengembalian berhasil diproses");
      setReturnModal(null); reload();
    } catch (e) { toast.error(e.message || "Gagal memproses pengembalian"); }
    finally { setSaving(false); }
  };

  const extraFees = ret.items.reduce((s, it) => s + Number(it.damage_fee || 0) + Number(it.lost_fee || 0), 0) + Number(ret.late_fee || 0);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="rental-page">
      <PageHeader title="Manajemen Rental" subtitle={`${rentals.length} rental`} />

      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nomor / pelanggan…" testid="rental-search" />
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="Semua Status" options={["OUT", "ACTIVE", "OVERDUE", "LATE", "RETURNED", "CANCELLED"]} className="sm:w-48" />
        </div>
        {filtered.length === 0 ? <EmptyState title="Belum ada rental" subtitle="Rental dibuat dari checkout booking atau POS." /> : (
          <Table>
            <thead><tr><Th>No.</Th><Th>Pelanggan</Th><Th>Keluar</Th><Th>Jatuh Tempo</Th><Th>Total</Th><Th>Status</Th><Th className="text-right">Aksi</Th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[#FEFCFD]" data-testid={`rental-row-${r.id}`}>
                  <Td className="font-mono text-xs">{r.rental_number}</Td>
                  <Td className="font-medium text-[#1F191E]">{r.customer?.name || "-"}</Td>
                  <Td className="text-xs">{formatDateShort(r.pickup_date)}</Td>
                  <Td className="text-xs">{formatDateShort(r.due_date)}</Td>
                  <Td className="font-semibold">{formatRupiah(r.total)}</Td>
                  <Td><StatusBadge status={isOverdue(r) ? "OVERDUE" : r.status} /></Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Btn variant="ghost" className="px-2 py-1.5" onClick={() => viewDetail(r)} data-testid={`rental-view-${r.id}`}><Eye className="h-4 w-4" /></Btn>
                      {["OUT", "ACTIVE", "OVERDUE", "LATE"].includes(r.status) && (
                        <Btn variant="secondary" className="px-2.5 py-1.5" onClick={() => openReturn(r)} data-testid={`rental-return-${r.id}`}><PackageOpen className="h-4 w-4" /> Kembalikan</Btn>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {/* Return modal */}
      <Modal open={!!returnModal} onClose={() => setReturnModal(null)} title="Proses Pengembalian" size="xl"
        footer={<><Btn variant="outline" onClick={() => setReturnModal(null)}>Batal</Btn><Btn onClick={submitReturn} loading={saving} data-testid="rental-return-submit">Selesaikan (Biaya: {formatRupiah(extraFees)})</Btn></>}>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tgl Kembali Aktual"><TextInput type="date" value={ret.actual_return_date} onChange={(e) => setRet({ ...ret, actual_return_date: e.target.value })} data-testid="return-date-input" /></Field>
          <Field label={`Denda Terlambat${ret._lateDays ? ` (${ret._lateDays} hari)` : ""}`}><TextInput type="number" value={ret.late_fee} onChange={(e) => setRet({ ...ret, late_fee: e.target.value })} data-testid="return-late-fee" /></Field>
          <Field label="Catatan"><TextInput value={ret.notes} onChange={(e) => setRet({ ...ret, notes: e.target.value })} /></Field>
        </div>
        <p className="text-sm font-semibold text-[#1F191E] mt-5 mb-2">Kondisi Item Saat Kembali</p>
        <div className="space-y-3">
          {ret.items.map((it, idx) => (
            <div key={idx} className="bg-[#FEFCFD] border border-[#FCE4EC] rounded-lg p-3" data-testid={`return-item-${idx}`}>
              <p className="text-sm font-medium text-[#1F191E]">{it.product_name} <span className="font-mono text-xs text-[#7A6A75]">{it.sku || ""}</span></p>
              <div className="grid sm:grid-cols-4 gap-2 mt-2">
                <Field label="Kondisi"><NativeSelect value={it.condition_return} onChange={(e) => updateRetItem(idx, { condition_return: e.target.value })} options={["GOOD", "MINOR_DAMAGE", "DAMAGED", "NEEDS_REPAIR"]} /></Field>
                <Field label="Status Unit"><NativeSelect value={it.inventory_status} onChange={(e) => updateRetItem(idx, { inventory_status: e.target.value })} options={["AVAILABLE", "MAINTENANCE", "DAMAGED", "LOST"]} /></Field>
                <Field label="Biaya Rusak"><TextInput type="number" value={it.damage_fee} onChange={(e) => updateRetItem(idx, { damage_fee: e.target.value })} /></Field>
                <Field label="Biaya Hilang"><TextInput type="number" value={it.lost_fee} onChange={(e) => updateRetItem(idx, { lost_fee: e.target.value })} /></Field>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Detail ${detail?.rental_number || ""}`} size="lg">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <p><span className="text-[#7A6A75]">Pelanggan:</span> <b>{detail.customer?.name}</b></p>
              <p><span className="text-[#7A6A75]">Status:</span> <StatusBadge status={detail.status} /></p>
              <p><span className="text-[#7A6A75]">Keluar:</span> {formatDateShort(detail.pickup_date)}</p>
              <p><span className="text-[#7A6A75]">Jatuh Tempo:</span> {formatDateShort(detail.due_date)}</p>
              {detail.actual_return_date && <p><span className="text-[#7A6A75]">Dikembalikan:</span> {formatDateShort(detail.actual_return_date)}</p>}
            </div>
            <Table>
              <thead><tr><Th>Produk</Th><Th>Unit</Th><Th>Keluar</Th><Th>Kembali</Th></tr></thead>
              <tbody>{(detail.items || []).map((it) => (
                <tr key={it.id}><Td>{it.product?.name}</Td><Td className="font-mono text-xs">{it.inventory?.sku || "-"}</Td><Td>{it.condition_out}</Td><Td>{it.condition_return || "-"}</Td></tr>
              ))}</tbody>
            </Table>
            <div className="flex flex-wrap justify-end gap-4">
              <span className="text-[#7A6A75]">Denda: <b>{formatRupiah(detail.late_fee)}</b></span>
              <span className="text-[#7A6A75]">Rusak: <b>{formatRupiah(detail.damage_fee)}</b></span>
              <span className="text-[#7A6A75]">Total: <b className="text-[#E83E8C]">{formatRupiah(detail.total)}</b></span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
