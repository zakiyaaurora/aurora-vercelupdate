import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import { supabase } from "@/lib/supabaseClient";
import {
  listProducts, listCategories, createProduct, updateProduct, deleteProduct, checkAvailability,
} from "@/lib/api";
import { formatRupiah, todayISO, addDays } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState, StatusBadge } from "@/components/common";
import { Field, TextInput, TextArea, NativeSelect, Btn, Modal, SearchInput } from "@/components/form";
import { useAuth } from "@/context/AuthContext";
import { Plus, Pencil, Trash2, CalendarSearch, Upload } from "lucide-react";
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
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [range, setRange] = useState({ start: todayISO(), end: addDays(todayISO(), 3) });
  const [avail, setAvail] = useState({});
  const [checking, setChecking] = useState(false);

  const products = useMemo(() => data?.products || [], [data]);
  const categories = data?.categories || [];

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const okSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.product_code || "").toLowerCase().includes(search.toLowerCase());
      const okCat = !cat || p.category_id === cat;
      return okSearch && okCat;
    });
  }, [products, search, cat]);

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

  const runAvailability = async () => {
    setChecking(true);
    try {
      const results = {};
      await Promise.all(filtered.map(async (p) => {
        results[p.id] = await checkAvailability(p.id, range.start, range.end);
      }));
      setAvail(results);
      toast.success("Ketersediaan diperbarui");
    } catch (e) {
      toast.error(e.message || "Gagal cek ketersediaan");
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="katalog-page">
      <PageHeader
        title="Katalog Kebaya"
        subtitle={`${products.length} produk terdaftar`}
        actions={canManage && <Btn onClick={openCreate} data-testid="katalog-add-btn"><Plus className="h-4 w-4" /> Tambah Produk</Btn>}
      />

      <SectionCard className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama / kode…" testid="katalog-search" />
          <NativeSelect
            value={cat} onChange={(e) => setCat(e.target.value)}
            placeholder="Semua Kategori"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            className="sm:w-48"
          />
          <div className="flex-1" />
          <div className="flex items-end gap-2">
            <Field label="Dari"><TextInput type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} className="w-40" /></Field>
            <Field label="Sampai"><TextInput type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} className="w-40" /></Field>
            <Btn variant="secondary" onClick={runAvailability} loading={checking} data-testid="katalog-check-availability"><CalendarSearch className="h-4 w-4" /> Cek Ketersediaan</Btn>
          </div>
        </div>
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyState title="Tidak ada produk" subtitle="Tambahkan produk kebaya pertama Anda." action={canManage && <Btn onClick={openCreate}><Plus className="h-4 w-4" /> Tambah Produk</Btn>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((p) => {
            const a = avail[p.id];
            return (
              <div key={p.id} className="bg-white border border-[#F8D7E3] rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(232,62,140,0.04)] hover:shadow-[0_4px_20px_rgba(232,62,140,0.1)] transition-all group" data-testid={`product-card-${p.id}`}>
                <div className="aspect-[4/5] bg-[#FFF5F8] overflow-hidden relative">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-[#E0A8C0] text-sm">Tanpa Foto</div>
                  )}
                  <div className="absolute top-3 left-3"><StatusBadge status={p.status === "ACTIVE" ? "AVAILABLE" : "INACTIVE"} /></div>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-[#B79BAA] font-medium">{p.category?.name || "—"} · {p.product_code || "—"}</p>
                  <h3 className="font-semibold text-[#1F191E] mt-0.5 truncate">{p.name}</h3>
                  <p className="text-[#E83E8C] font-bold mt-1">{formatRupiah(p.rental_price)} <span className="text-xs font-normal text-[#7A6A75]">/sewa</span></p>
                  {a && (
                    <div className="mt-2 text-xs" data-testid={`availability-${p.id}`}>
                      {a.available > 0 ? (
                        <span className="text-[#047857] font-medium">✓ Tersedia {a.available}/{a.total} unit</span>
                      ) : (
                        <span className="text-[#B91C1C] font-medium">✕ Tidak tersedia pada tanggal ini</span>
                      )}
                    </div>
                  )}
                  {canManage && (
                    <div className="mt-3 flex gap-2">
                      <Btn variant="secondary" className="flex-1 py-1.5" onClick={() => openEdit(p)} data-testid={`product-edit-${p.id}`}><Pencil className="h-3.5 w-3.5" /> Edit</Btn>
                      <Btn variant="ghost" className="px-2.5 py-1.5 text-[#B91C1C]" onClick={() => remove(p)} data-testid={`product-delete-${p.id}`}><Trash2 className="h-4 w-4" /></Btn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
