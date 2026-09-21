import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import {
  listInventory, listProducts, createInventory, updateInventory, deleteInventory,
  listStockMovements, createStockMovement,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState, StatCard, StatusBadge } from "@/components/common";
import { Field, TextInput, TextArea, NativeSelect, Btn, Modal, SearchInput, Table, Th, Td } from "@/components/form";
import { INVENTORY_STATUS, INVENTORY_CONDITION } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { Plus, Pencil, Trash2, Boxes, PackageCheck, PackageX, Wrench, WashingMachine, CheckCircle2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const empty = { product_id: "", sku: "", serial_number: "", condition: "GOOD", status: "AVAILABLE", location: "", notes: "" };

const INVENTORY_STATUS_WITH_CUCI = Array.from(
  new Set([...INVENTORY_STATUS, "CUCI"])
);

export default function Stok() {
  const { role } = useAuth();
  const canManage = ["OWNER", "ADMIN"].includes(role);
  const { data, loading, error, reload } = useAsync(async () => {
    const [inventory, products, movements] = await Promise.all([listInventory(), listProducts(), listStockMovements()]);
    return { inventory, products, movements };
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const inventory = useMemo(() => data?.inventory || [], [data]);
  const products = data?.products || [];
  const movements = data?.movements || [];

  const counts = useMemo(() => {
    const c = {
      total: inventory.length,
      AVAILABLE: 0,
      RENTED: 0,
      BOOKED: 0,
      CUCI: 0,
      MAINTENANCE: 0,
      DAMAGED: 0,
      LOST: 0,
    };

    inventory.forEach((i) => {
      c[i.status] = (c[i.status] || 0) + 1;
    });

    return c;
  }, [inventory]);

  const filtered = useMemo(() => inventory.filter((i) => {
    const okS = !search || (i.sku || "").toLowerCase().includes(search.toLowerCase()) || (i.product?.name || "").toLowerCase().includes(search.toLowerCase());
    const okF = !statusFilter || i.status === statusFilter;
    return okS && okF;
  }), [inventory, search, statusFilter]);

  const save = async () => {
    if (!form.product_id) { toast.error("Pilih produk"); return; }
    setSaving(true);
    try {
      const payload = {
        product_id: form.product_id,
        sku: form.sku || null,
        serial_number: form.serial_number,
        condition: form.condition,
        status: form.status,
        location: form.location,
        notes: form.notes,
      };

      if (modal === "edit") {
        await updateInventory(form.id, payload);
      } else {
        await createInventory(payload);
        await createStockMovement({
          product_id: form.product_id,
          quantity: 1,
          type: "STOCK_IN",
          notes: `Tambah unit ${form.sku || ""}`,
        });
      }

      toast.success("Unit tersimpan");
      setModal(null);
      reload();
    } catch (e) {
      toast.error(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const completeWash = async (i) => {
    if (!window.confirm(`Tandai unit ${i.sku || i.id} sudah selesai dicuci dan siap dipakai?`)) return;

    try {
      await updateInventory(i.id, {
        product_id: i.product_id,
        sku: i.sku || null,
        serial_number: i.serial_number || null,
        condition: i.condition || "GOOD",
        status: "AVAILABLE",
        location: i.location || null,
        notes: i.notes || null,
      });

      toast.success("Unit selesai dicuci dan kembali Tersedia");
      reload();
    } catch (e) {
      toast.error(e.message || "Gagal menyelesaikan proses cuci");
    }
  };

  const remove = async (i) => {
    if (!window.confirm(`Hapus unit ${i.sku || i.id}?`)) return;
    try { await deleteInventory(i.id); toast.success("Unit dihapus"); reload(); }
    catch (e) { toast.error(e.message || "Gagal menghapus"); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="stok-page">
      <PageHeader
        title="Stok & Inventaris"
        subtitle={`${counts.total} unit fisik`}
        actions={canManage && (
          <Btn
            onClick={() => { setForm(empty); setModal("create"); }}
            data-testid="inventory-add-btn"
          >
            <Plus className="h-4 w-4" /> Tambah Unit
          </Btn>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Unit" value={counts.total} icon={Boxes} tone="pink" />
        <StatCard label="Tersedia" value={counts.AVAILABLE} icon={PackageCheck} tone="green" />
        <StatCard label="Disewa" value={counts.RENTED} icon={Boxes} tone="amber" />
        <StatCard label="Sedang Dicuci" value={counts.CUCI} icon={WashingMachine} tone="blue" />
        <StatCard label="Maintenance / Rusak" value={counts.MAINTENANCE + counts.DAMAGED + counts.LOST} icon={Wrench} tone="red" />
      </div>

      <Tabs defaultValue="units">
        <TabsList className="bg-[#FFF5F8]">
          <TabsTrigger value="units" data-testid="tab-units">Unit Inventaris</TabsTrigger>
          <TabsTrigger value="movements" data-testid="tab-movements">Pergerakan Stok</TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="mt-4">
          <SectionCard>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <SearchInput value={search} onChange={setSearch} placeholder="Cari SKU / produk…" testid="inventory-search" />
              <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="Semua Status" options={INVENTORY_STATUS_WITH_CUCI} className="sm:w-48" />
            </div>

            {filtered.length === 0 ? <EmptyState title="Tidak ada unit" /> : (
              <Table>
                <thead>
                  <tr>
                    <Th>SKU</Th>
                    <Th>Produk</Th>
                    <Th>Kondisi</Th>
                    <Th>Status</Th>
                    <Th>Lokasi</Th>
                    {canManage && <Th className="text-right">Aksi</Th>}
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id} className="hover:bg-[#FEFCFD]" data-testid={`inventory-row-${i.id}`}>
                      <Td className="font-mono text-xs">{i.sku || "-"}</Td>
                      <Td className="font-medium text-[#1F191E]">{i.product?.name || "-"}</Td>
                      <Td><StatusBadge status={i.condition} /></Td>
                      <Td>
                        {i.status === "CUCI" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                            🧺 CUCI
                          </span>
                        ) : (
                          <StatusBadge status={i.status} />
                        )}
                      </Td>
                      <Td>{i.location || "-"}</Td>

                      {canManage && (
                        <Td>
                          <div className="flex justify-end gap-1.5">
                            {i.status === "CUCI" && (
                              <Btn
                                variant="secondary"
                                className="px-2 py-1.5 text-xs"
                                onClick={() => completeWash(i)}
                                data-testid={`inventory-wash-complete-${i.id}`}
                                title="Selesai Cuci"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Selesai Cuci
                              </Btn>
                            )}

                            <Btn
                              variant="ghost"
                              className="px-2 py-1.5"
                              onClick={() => { setForm({ ...empty, ...i }); setModal("edit"); }}
                              data-testid={`inventory-edit-${i.id}`}
                              title="Edit Unit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Btn>

                            <Btn
                              variant="ghost"
                              className="px-2 py-1.5 text-[#B91C1C]"
                              onClick={() => remove(i)}
                              data-testid={`inventory-delete-${i.id}`}
                              title="Hapus Unit"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Btn>
                          </div>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <SectionCard>
            {movements.length === 0 ? <EmptyState title="Belum ada pergerakan stok" /> : (
              <Table>
                <thead>
                  <tr>
                    <Th>Waktu</Th>
                    <Th>Produk</Th>
                    <Th>SKU</Th>
                    <Th>Tipe</Th>
                    <Th>Qty</Th>
                    <Th>Catatan</Th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FEFCFD]">
                      <Td className="text-xs">{formatDateTime(m.created_at)}</Td>
                      <Td className="font-medium text-[#1F191E]">{m.product?.name || "-"}</Td>
                      <Td className="font-mono text-xs">{m.inventory?.sku || "-"}</Td>
                      <Td><span className="text-xs font-semibold text-[#6D28D9]">{m.type}</span></Td>
                      <Td className={m.quantity < 0 ? "text-[#B91C1C]" : "text-[#047857]"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</Td>
                      <Td className="max-w-[240px] truncate">{m.notes || "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "edit" ? "Edit Unit" : "Tambah Unit Inventaris"}
        footer={
          <>
            <Btn variant="outline" onClick={() => setModal(null)}>Batal</Btn>
            <Btn onClick={save} loading={saving} data-testid="inventory-save-btn">Simpan</Btn>
          </>
        }
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Produk" required className="sm:col-span-2">
            <NativeSelect
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              placeholder="Pilih produk"
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              data-testid="inventory-product-select"
            />
          </Field>

          <Field label="SKU">
            <TextInput value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="KR001" data-testid="inventory-sku-input" />
          </Field>

          <Field label="Serial Number">
            <TextInput value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
          </Field>

          <Field label="Kondisi">
            <NativeSelect value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} options={INVENTORY_CONDITION} />
          </Field>

          <Field label="Status">
            <NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={INVENTORY_STATUS_WITH_CUCI} />
          </Field>

          <Field label="Lokasi" className="sm:col-span-2">
            <TextInput value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Rak A" />
          </Field>

          <Field label="Catatan" className="sm:col-span-2">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
