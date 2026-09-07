import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import {
  listProducts, listCategories, createProduct, updateProduct, deleteProduct, checkAvailability, catalogAvailability,
} from "@/lib/api";
import { todayISO, addDays, formatDateShort } from "@/lib/format";
import { availabilityText } from "@/lib/availability";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState } from "@/components/common";
import { Field, TextInput, TextArea, NativeSelect, Btn, Modal, SearchInput } from "@/components/form";
import CatalogCard from "@/components/CatalogCard";
import ScheduleModal from "@/components/ScheduleModal";
import { useAuth } from "@/context/AuthContext";
import { Plus, CalendarSearch, Upload, Globe } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "", product_code: "", category_id: "", color: "", size: "", material: "", brand: "",
  rental_price: "", deposit: "", late_fee_per_day: "", purchase_price: "", description: "",
  status: "ACTIVE", photo_url: "",
};

export default function Katalog() {
  const { role } = useAuth();
  const canManage = ["OWNER", "ADMIN"].includes(role);
  const { data, loading, error, reload } = useAsync(async () => {
    const [products, categories] = await Promise.all([listProducts(), listCategories()]);
    return { products, categories };
  }, []);

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [availFilter, setAvailFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [range, setRange] = useState({ start: todayISO(), end: addDays(todayISO(), 3) });
  const [avail, setAvail] = useState({});
  const [checking, setChecking] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [schedule, setSchedule] = useState(null);

  const products = useMemo(() => data?.products || [], [data]);
  const categories = data?.categories || [];
  const rangeValid = Boolean(range.start && range.end && range.end >= range.start);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const okSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.product_code || "").toLowerCase().includes(search.toLowerCase());
      const okCat = !cat || p.category_id === cat;
      const a = avail[p.id];
      const okAvail = !availFilter || (a && (availFilter === "available" ? Number(a.available) > 0 : Number(a.available) <= 0));
      return okSearch && okCat && okAvail;
    });
  }, [products, search, cat, availFilter, avail]);

  const availableCount = useMemo(() => products.filter((p) => Number(avail[p.id]?.available || 0) > 0).length, [products, avail]);

  const openCreate = () => { setForm(empty); setModal("create"); };
  const openEdit = (p) => {
    setForm({
      ...empty, ...p,
      category_id: p.category_id || "",
      rental_price: p.rental_price ?? "", deposit: p.deposit ?? "",
      late_fee_per_day: p.late_fee_per_day ?? "", purchase_price: p.purchase_price ?? "",
    });
    setModal("edit");
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `products/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: pub.publicUrl }));
      toast.success("Foto berhasil diunggah");
    } catch (e) {
      toast.error("Gagal unggah foto. Pastikan bucket 'product-images' publik sudah dibuat. " + (e.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name) { toast.error("Nama produk wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, product_code: form.product_code || null, category_id: form.category_id || null,
        color: form.color, size: form.size, material: form.material, brand: form.brand,
        rental_price: Number(form.rental_price || 0), deposit: Number(form.deposit || 0),
        late_fee_per_day: Number(form.late_fee_per_day || 0), purchase_price: Number(form.purchase_price || 0),
        description: form.description, status: form.status, photo_url: form.photo_url || null,
      };
      if (modal === "edit") await updateProduct(form.id, payload);
      else await createProduct(payload);
      toast.success("Produk tersimpan");
      setModal(null);
      reload();
    } catch (e) {
      toast.error(e.message || "Gagal menyimpan produk");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Hapus produk "${p.name}"?`)) return;
    try { await deleteProduct(p.id); toast.success("Produk dihapus"); reload(); }
    catch (e) { toast.error(e.message || "Gagal menghapus"); }
  };

  // Ketersediaan semua produk untuk rentang tanggal terpilih (1 panggilan RPC)
  const runAvailability = useCallback(async () => {
    if (!rangeValid) return;
    setChecking(true);
    try {
      const rows = await catalogAvailability(range.start, range.end);
      const map = {};
      (rows || []).forEach((r) => { map[r.product_id] = r; });
      setAvail(map);
    } catch (e) {
      toast.error(e.message || "Gagal cek ketersediaan");
    } finally {
      setChecking(false);
    }
  }, [range.start, range.end, rangeValid]);

  // Otomatis hitung ulang saat tanggal berubah / data produk dimuat
  useEffect(() => { if (data) runAvailability(); }, [data, runAvailability]);

  const checkOne = async (p) => {
    if (!rangeValid) { toast.error("Tanggal selesai harus setelah tanggal mulai"); return; }
    setCheckingId(p.id);
    try {
      const a = await checkAvailability(p.id, range.start, range.end);
      setAvail((m) => ({ ...m, [p.id]: { product_id: p.id, ...a } }));
      const text = availabilityText(a);
      if (Number(a.available) > 0) toast.success(`${p.name}: ${text}`); else toast.error(`${p.name}: ${text}`);
    } catch (e) { toast.error(e.message || "Gagal cek ketersediaan"); }
    finally { setCheckingId(null); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="katalog-page">
      <PageHeader
        title="Katalog Kebaya"
        subtitle={`${products.length} produk terdaftar · ${availableCount} tersedia pada ${formatDateShort(range.start)} – ${formatDateShort(range.end)}`}
        actions={<>
          <Link to="/sewa" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#E2D5DD] hover:bg-[#FAF7F8] px-3.5 py-2 text-sm font-medium text-[#1F191E]" data-testid="katalog-public-link"><Globe className="h-4 w-4" /> Katalog Publik</Link>
          {canManage && <Btn onClick={openCreate} data-testid="katalog-add-btn"><Plus className="h-4 w-4" /> Tambah Produk</Btn>}
        </>}
      />

      <SectionCard className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama / kode…" testid="katalog-search" />
          <NativeSelect
            value={cat} onChange={(e) => setCat(e.target.value)}
            placeholder="Semua Kategori"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            className="sm:w-44"
            data-testid="katalog-category-filter"
          />
          <NativeSelect
            value={availFilter} onChange={(e) => setAvailFilter(e.target.value)}
            placeholder="Semua Status"
            options={[{ value: "available", label: "Hanya yang tersedia" }, { value: "unavailable", label: "Tidak tersedia" }]}
            className="sm:w-48"
            data-testid="katalog-availability-filter"
          />
          <div className="flex-1" />
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Tgl Mulai Sewa"><TextInput type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} className="w-40" data-testid="katalog-start-date" /></Field>
            <Field label="Tgl Selesai Sewa"><TextInput type="date" value={range.end} min={range.start} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className="w-40" data-testid="katalog-end-date" /></Field>
            <Btn variant="secondary" onClick={runAvailability} loading={checking} data-testid="katalog-check-availability"><CalendarSearch className="h-4 w-4" /> Cek Ketersediaan</Btn>
          </div>
        </div>
        {!rangeValid && <p className="mt-2 text-xs text-[#B91C1C]">Tanggal selesai harus setelah tanggal mulai.</p>}
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyState title="Tidak ada produk" subtitle={availFilter ? "Tidak ada produk dengan status tersebut pada tanggal yang dipilih." : "Tambahkan produk kebaya pertama Anda."} action={canManage && !availFilter && <Btn onClick={openCreate}><Plus className="h-4 w-4" /> Tambah Produk</Btn>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((p) => (
            <CatalogCard key={p.id} product={p} avail={avail[p.id]} checking={checkingId === p.id} canManage={canManage}
              onCheck={checkOne} onSchedule={(prod) => setSchedule(prod)} onEdit={openEdit} onDelete={remove} />
          ))}
        </div>
      )}

      <ScheduleModal product={schedule} open={!!schedule} onClose={() => setSchedule(null)} startDate={rangeValid ? range.start : null} endDate={rangeValid ? range.end : null} />

      <Modal
        open={!!modal} onClose={() => setModal(null)}
        title={modal === "edit" ? "Edit Produk" : "Tambah Produk"} size="lg"
        footer={<><Btn variant="outline" onClick={() => setModal(null)}>Batal</Btn><Btn onClick={save} loading={saving} data-testid="product-save-btn">Simpan</Btn></>}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nama Produk" required className="sm:col-span-2"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-name-input" /></Field>
          <Field label="Kode Produk"><TextInput value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} placeholder="PRD-0001" /></Field>
          <Field label="Kategori"><NativeSelect value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} placeholder="Pilih kategori" options={categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Warna"><TextInput value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
          <Field label="Ukuran"><TextInput value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
          <Field label="Material"><TextInput value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} /></Field>
          <Field label="Brand"><TextInput value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label="Harga Sewa"><TextInput type="number" value={form.rental_price} onChange={(e) => setForm({ ...form, rental_price: e.target.value })} data-testid="product-price-input" /></Field>
          <Field label="Deposit"><TextInput type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></Field>
          <Field label="Denda / Hari"><TextInput type="number" value={form.late_fee_per_day} onChange={(e) => setForm({ ...form, late_fee_per_day: e.target.value })} /></Field>
          <Field label="Harga Beli"><TextInput type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></Field>
          <Field label="Status"><NativeSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={["ACTIVE", "INACTIVE"]} /></Field>
          <Field label="Foto Produk" className="sm:col-span-2">
            <div className="flex items-center gap-3">
              {form.photo_url && <img src={form.photo_url} alt="preview" className="h-16 w-16 rounded-lg object-cover border border-[#F8D7E3]" />}
              <label className="inline-flex items-center gap-2 rounded-lg border border-[#F0C4D6] px-3.5 py-2 text-sm text-[#4A3F47] cursor-pointer hover:bg-[#FFF5F8]">
                <Upload className="h-4 w-4" /> {uploading ? "Mengunggah…" : "Pilih Foto"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} data-testid="product-photo-input" />
              </label>
              <TextInput value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="atau tempel URL foto" className="flex-1" />
            </div>
          </Field>
          <Field label="Deskripsi" className="sm:col-span-2"><TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
