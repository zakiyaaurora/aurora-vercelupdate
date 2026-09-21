import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import { listRentals, getRental, returnRental } from "@/lib/api";
import { formatRupiah, formatDateShort, todayISO, daysBetween } from "@/lib/format";
import {
  PageHeader,
  SectionCard,
  Loading,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "@/components/common";
import {
  Field,
  TextInput,
  TextArea,
  NativeSelect,
  Btn,
  Modal,
  SearchInput,
  Table,
  Th,
  Td,
} from "@/components/form";
import {
  PackageOpen,
  Eye,
  CalendarDays,
  Clock3,
  RotateCcw,
  CheckCircle2,
  WashingMachine,
  Wrench,
  AlertTriangle,
  PackageX,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";

const RETURN_STATUS_OPTIONS = [
  {
    value: "AVAILABLE",
    label: "Tersedia",
    description: "Sudah siap dipakai kembali",
    icon: CheckCircle2,
    tone: "emerald",
  },
  {
    value: "CUCI",
    label: "Cuci",
    description: "Perlu dicuci sebelum disewakan lagi",
    icon: WashingMachine,
    tone: "sky",
  },
  {
    value: "MAINTENANCE",
    label: "Maintenance",
    description: "Perlu perbaikan / perawatan",
    icon: Wrench,
    tone: "amber",
  },
  {
    value: "DAMAGED",
    label: "Rusak",
    description: "Mengalami kerusakan",
    icon: AlertTriangle,
    tone: "rose",
  },
  {
    value: "LOST",
    label: "Hilang",
    description: "Unit tidak ditemukan",
    icon: PackageX,
    tone: "slate",
  },
];

const getReturnStatusMeta = (status) =>
  RETURN_STATUS_OPTIONS.find((item) => item.value === status) ||
  RETURN_STATUS_OPTIONS[0];

export default function Rental() {
  const { data, loading, error, reload } = useAsync(listRentals, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [returnModal, setReturnModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ret, setRet] = useState({
    actual_return_date: todayISO(),
    late_fee: 0,
    notes: "",
    items: [],
  });

  const rentals = useMemo(() => data || [], [data]);

  const filtered = useMemo(
    () =>
      rentals.filter((r) => {
        const okS =
          !search ||
          (r.rental_number || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (r.customer?.name || "")
            .toLowerCase()
            .includes(search.toLowerCase());

        const okF = !statusFilter || r.status === statusFilter;

        return okS && okF;
      }),
    [rentals, search, statusFilter]
  );

  const isOverdue = (r) =>
    ["OUT", "ACTIVE"].includes(r.status) &&
    r.due_date < todayISO() &&
    !r.actual_return_date;

  const viewDetail = async (r) => {
    try {
      setDetail(await getRental(r.id));
    } catch (e) {
      toast.error(e.message);
    }
  };

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
        customer_name: full.customer?.name || "",
        items: (full.items || []).map((it) => ({
          rental_item_id: it.id,
          inventory_item_id: it.inventory_item_id,
          product_name: it.product?.name,
          sku: it.inventory?.sku,
          condition_return: "GOOD",
          inventory_status: "AVAILABLE",
          damage_fee: 0,
          lost_fee: 0,
          notes: "",
        })),
      });

      setReturnModal(r.id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateRetItem = (idx, patch) =>
    setRet((s) => ({
      ...s,
      items: s.items.map((it, i) =>
        i === idx ? { ...it, ...patch } : it
      ),
    }));

  const submitReturn = async () => {
    setSaving(true);

    try {
      await returnRental({
        rental_id: returnModal,
        actual_return_date: ret.actual_return_date,
        late_fee: Number(ret.late_fee || 0),
        notes: ret.notes,
        items: ret.items.map((it) => ({
          rental_item_id: it.rental_item_id,
          inventory_item_id: it.inventory_item_id,
          condition_return: it.condition_return,
          inventory_status: it.inventory_status,
          damage_fee: Number(it.damage_fee || 0),
          lost_fee: Number(it.lost_fee || 0),
          notes: it.notes,
        })),
      });

      toast.success("Pengembalian berhasil diproses");
      setReturnModal(null);
      reload();
    } catch (e) {
      toast.error(e.message || "Gagal memproses pengembalian");
    } finally {
      setSaving(false);
    }
  };

  const extraFees =
    ret.items.reduce(
      (s, it) =>
        s +
        Number(it.damage_fee || 0) +
        Number(it.lost_fee || 0),
      0
    ) + Number(ret.late_fee || 0);

  const selectedReturnCount = ret.items.filter(
    (it) => it.inventory_status === "CUCI"
  ).length;

  const toneClasses = {
    emerald: {
      active:
        "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm",
      icon: "bg-emerald-100 text-emerald-700",
      hover: "hover:border-emerald-200 hover:bg-emerald-50/70",
    },
    sky: {
      active: "border-sky-300 bg-sky-50 text-sky-800 shadow-sm",
      icon: "bg-sky-100 text-sky-700",
      hover: "hover:border-sky-200 hover:bg-sky-50/70",
    },
    amber: {
      active: "border-amber-300 bg-amber-50 text-amber-800 shadow-sm",
      icon: "bg-amber-100 text-amber-700",
      hover: "hover:border-amber-200 hover:bg-amber-50/70",
    },
    rose: {
      active: "border-rose-300 bg-rose-50 text-rose-800 shadow-sm",
      icon: "bg-rose-100 text-rose-700",
      hover: "hover:border-rose-200 hover:bg-rose-50/70",
    },
    slate: {
      active: "border-slate-300 bg-slate-50 text-slate-800 shadow-sm",
      icon: "bg-slate-100 text-slate-700",
      hover: "hover:border-slate-200 hover:bg-slate-50/70",
    },
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="rental-page" className="space-y-5">
      <PageHeader
        title="Manajemen Rental"
        subtitle={`${rentals.length} rental`}
      />

      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nomor / pelanggan…"
            testid="rental-search"
          />

          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Semua Status"
            options={[
              "OUT",
              "ACTIVE",
              "OVERDUE",
              "LATE",
              "RETURNED",
              "CANCELLED",
            ]}
            className="sm:w-48"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Belum ada rental"
            subtitle="Rental dibuat dari checkout booking atau POS."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>No.</Th>
                <Th>Pelanggan</Th>
                <Th>Keluar</Th>
                <Th>Jatuh Tempo</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-[#FEFCFD]"
                  data-testid={`rental-row-${r.id}`}
                >
                  <Td className="font-mono text-xs">
                    {r.rental_number}
                  </Td>

                  <Td className="font-medium text-[#1F191E]">
                    {r.customer?.name || "-"}
                  </Td>

                  <Td className="text-xs">
                    {formatDateShort(r.pickup_date)}
                  </Td>

                  <Td className="text-xs">
                    {formatDateShort(r.due_date)}
                  </Td>

                  <Td className="font-semibold">
                    {formatRupiah(r.total)}
                  </Td>

                  <Td>
                    <StatusBadge
                      status={isOverdue(r) ? "OVERDUE" : r.status}
                    />
                  </Td>

                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Btn
                        variant="ghost"
                        className="px-2 py-1.5"
                        onClick={() => viewDetail(r)}
                        data-testid={`rental-view-${r.id}`}
                        title="Lihat Detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Btn>

                      {["OUT", "ACTIVE", "OVERDUE", "LATE"].includes(
                        r.status
                      ) && (
                        <Btn
                          variant="secondary"
                          className="px-2.5 py-1.5"
                          onClick={() => openReturn(r)}
                          data-testid={`rental-return-${r.id}`}
                        >
                          <PackageOpen className="h-4 w-4" />
                          Kembalikan
                        </Btn>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {/* RETURN MODAL */}
      <Modal
        open={!!returnModal}
        onClose={() => {
          if (!saving) setReturnModal(null);
        }}
        title="Proses Pengembalian"
        size="xl"
        footer={
          <>
            <Btn
              variant="outline"
              onClick={() => setReturnModal(null)}
              disabled={saving}
            >
              Batal
            </Btn>

            <Btn
              onClick={submitReturn}
              loading={saving}
              data-testid="rental-return-submit"
            >
              <ClipboardCheck className="h-4 w-4" />
              Selesaikan
              {extraFees > 0
                ? ` · ${formatRupiah(extraFees)}`
                : ""}
            </Btn>
          </>
        }
      >
        <div className="space-y-5">
          {/* RETURN HEADER */}
          <div className="rounded-2xl border border-[#FCE4EC] bg-gradient-to-r from-[#FFF8FB] to-white p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-[#FFF0F6] text-[#E83E8C] grid place-items-center">
                    <RotateCcw className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-xs text-[#A18895]">
                      Proses pengembalian
                    </p>
                    <p className="font-bold text-[#1F191E]">
                      {ret.rental_number || "-"}
                    </p>
                  </div>
                </div>

                {ret.customer_name && (
                  <p className="text-sm text-[#6D5A65] mt-2">
                    Pelanggan:{" "}
                    <span className="font-semibold text-[#1F191E]">
                      {ret.customer_name}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-[#6D5A65]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#F3D9E4] px-3 py-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-[#E83E8C]" />
                  {formatDateShort(ret.actual_return_date)}
                </span>

                {ret._lateDays > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 font-semibold text-amber-800">
                    <Clock3 className="h-3.5 w-3.5" />
                    {ret._lateDays} hari terlambat
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* GENERAL RETURN DATA */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Tanggal Kembali Aktual">
              <TextInput
                type="date"
                value={ret.actual_return_date}
                onChange={(e) =>
                  setRet({
                    ...ret,
                    actual_return_date: e.target.value,
                  })
                }
                data-testid="return-date-input"
              />
            </Field>

            <Field
              label={`Denda Terlambat${
                ret._lateDays ? ` (${ret._lateDays} hari)` : ""
              }`}
            >
              <TextInput
                type="number"
                value={ret.late_fee}
                onChange={(e) =>
                  setRet({
                    ...ret,
                    late_fee: e.target.value,
                  })
                }
                data-testid="return-late-fee"
              />
            </Field>

            <Field label="Catatan Pengembalian">
              <TextInput
                value={ret.notes}
                onChange={(e) =>
                  setRet({
                    ...ret,
                    notes: e.target.value,
                  })
                }
                placeholder="Catatan umum pengembalian"
              />
            </Field>
          </div>

          {/* QUICK STATUS SUMMARY */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-[#F3D9E4] bg-white p-3">
              <p className="text-[11px] text-[#A18895]">
                Total Item
              </p>
              <p className="text-xl font-bold text-[#1F191E] mt-1">
                {ret.items.length}
              </p>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-[11px] text-sky-700">
                Akan Dicuci
              </p>
              <p className="text-xl font-bold text-sky-800 mt-1">
                {selectedReturnCount}
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] text-amber-700">
                Maintenance
              </p>
              <p className="text-xl font-bold text-amber-800 mt-1">
                {
                  ret.items.filter(
                    (it) => it.inventory_status === "MAINTENANCE"
                  ).length
                }
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[11px] text-emerald-700">
                Siap Tersedia
              </p>
              <p className="text-xl font-bold text-emerald-800 mt-1">
                {
                  ret.items.filter(
                    (it) => it.inventory_status === "AVAILABLE"
                  ).length
                }
              </p>
            </div>
          </div>

          {/* ITEM RETURN */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-base font-bold text-[#1F191E]">
                  Kondisi Item Saat Kembali
                </p>
                <p className="text-xs text-[#7A6A75] mt-1">
                  Tentukan status setiap unit secara manual.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {ret.items.map((it, idx) => {
                const selectedMeta = getReturnStatusMeta(
                  it.inventory_status
                );
                const SelectedIcon = selectedMeta.icon;
                const selectedTone =
                  toneClasses[selectedMeta.tone] || toneClasses.emerald;

                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-[#FCE4EC] bg-[#FEFCFD] p-4"
                    data-testid={`return-item-${idx}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-start gap-3">
                          <div className="h-11 w-11 rounded-xl bg-[#FFF0F6] text-[#E83E8C] grid place-items-center shrink-0">
                            <PackageOpen className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#1F191E]">
                              {it.product_name || "-"}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {it.sku && (
                                <span className="font-mono text-[11px] text-[#7A6A75] bg-white border border-[#F3D9E4] rounded-full px-2 py-1">
                                  {it.sku}
                                </span>
                              )}

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${selectedTone.active}`}
                              >
                                <SelectedIcon className="h-3.5 w-3.5" />
                                {selectedMeta.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:min-w-[430px]">
                        <Field label="Kondisi">
                          <NativeSelect
                            value={it.condition_return}
                            onChange={(e) =>
                              updateRetItem(idx, {
                                condition_return: e.target.value,
                              })
                            }
                            options={[
                              "GOOD",
                              "MINOR_DAMAGE",
                              "DAMAGED",
                              "NEEDS_REPAIR",
                            ]}
                          />
                        </Field>

                        <Field label="Biaya Rusak">
                          <TextInput
                            type="number"
                            value={it.damage_fee}
                            onChange={(e) =>
                              updateRetItem(idx, {
                                damage_fee: e.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field label="Biaya Hilang">
                          <TextInput
                            type="number"
                            value={it.lost_fee}
                            onChange={(e) =>
                              updateRetItem(idx, {
                                lost_fee: e.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field label="Catatan Item">
                          <TextInput
                            value={it.notes}
                            onChange={(e) =>
                              updateRetItem(idx, {
                                notes: e.target.value,
                              })
                            }
                            placeholder="Opsional"
                          />
                        </Field>
                      </div>
                    </div>

                    {/* VISUAL STATUS PICKER */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-[#6D5A65]">
                          Status Unit Setelah Dikembalikan
                        </p>
                        <span className="text-[11px] text-[#A18895]">
                          Pilih manual
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                        {RETURN_STATUS_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          const tone = toneClasses[option.tone];
                          const active =
                            it.inventory_status === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                updateRetItem(idx, {
                                  inventory_status: option.value,
                                })
                              }
                              className={`group rounded-xl border p-3 text-left transition-all ${
                                active
                                  ? tone.active
                                  : `border-[#F3D9E4] bg-white ${tone.hover}`
                              }`}
                              data-testid={`return-status-${option.value.toLowerCase()}-${idx}`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div
                                  className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${
                                    active
                                      ? tone.icon
                                      : "bg-[#FAF6F8] text-[#8E7884]"
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <p
                                    className={`text-xs font-bold ${
                                      active
                                        ? ""
                                        : "text-[#1F191E]"
                                    }`}
                                  >
                                    {option.label}
                                  </p>

                                  <p
                                    className={`text-[10px] leading-4 mt-0.5 ${
                                      active
                                        ? "opacity-80"
                                        : "text-[#8E7884]"
                                    }`}
                                  >
                                    {option.description}
                                  </p>
                                </div>

                                {active && (
                                  <CheckCircle2 className="h-4 w-4 ml-auto shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INFO */}
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <div className="flex items-start gap-2">
              <WashingMachine className="h-4 w-4 text-sky-700 mt-0.5 shrink-0" />

              <div>
                <p className="text-xs font-bold text-sky-800">
                  Alur unit setelah kembali
                </p>

                <p className="text-xs text-sky-700 mt-1 leading-5">
                  Status unit dipilih manual. Unit yang dipilih{" "}
                  <b>CUCI</b> tetap tidak boleh dianggap siap dipakai
                  sampai operator menekan <b>Selesai Cuci</b> di Stok &
                  Inventaris.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={`Detail ${detail?.rental_number || ""}`}
        size="lg"
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <p>
                <span className="text-[#7A6A75]">
                  Pelanggan:
                </span>{" "}
                <b>{detail.customer?.name}</b>
              </p>

              <p>
                <span className="text-[#7A6A75]">
                  Status:
                </span>{" "}
                <StatusBadge status={detail.status} />
              </p>

              <p>
                <span className="text-[#7A6A75]">
                  Keluar:
                </span>{" "}
                {formatDateShort(detail.pickup_date)}
              </p>

              <p>
                <span className="text-[#7A6A75]">
                  Jatuh Tempo:
                </span>{" "}
                {formatDateShort(detail.due_date)}
              </p>

              {detail.actual_return_date && (
                <p>
                  <span className="text-[#7A6A75]">
                    Dikembalikan:
                  </span>{" "}
                  {formatDateShort(detail.actual_return_date)}
                </p>
              )}
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th>Unit</Th>
                  <Th>Keluar</Th>
                  <Th>Kembali</Th>
                </tr>
              </thead>

              <tbody>
                {(detail.items || []).map((it) => (
                  <tr key={it.id}>
                    <Td>{it.product?.name}</Td>
                    <Td className="font-mono text-xs">
                      {it.inventory?.sku || "-"}
                    </Td>
                    <Td>{it.condition_out}</Td>
                    <Td>{it.condition_return || "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="flex flex-wrap justify-end gap-4">
              <span className="text-[#7A6A75]">
                Denda:{" "}
                <b>{formatRupiah(detail.late_fee)}</b>
              </span>

              <span className="text-[#7A6A75]">
                Rusak:{" "}
                <b>{formatRupiah(detail.damage_fee)}</b>
              </span>

              <span className="text-[#7A6A75]">
                Total:{" "}
                <b className="text-[#E83E8C]">
                  {formatRupiah(detail.total)}
                </b>
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
