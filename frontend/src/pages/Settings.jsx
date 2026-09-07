import { useState, useEffect } from "react";
import { useAsync } from "@/lib/hooks";
import { getSetting, saveSetting, listCategories, createCategory, updateCategory, deleteCategory, listAuditLogs } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState } from "@/components/common";
import { Field, TextInput, TextArea, Btn, Table, Th, Td } from "@/components/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [store, categories, logs] = await Promise.all([
      getSetting("store").catch(() => null), listCategories(), listAuditLogs().catch(() => []),
    ]);
    return { store: store?.value || {}, categories, logs };
  }, []);

  const [store, setStore] = useState({ name: "", address: "", phone: "", email: "", terms: "" });
  const [savingStore, setSavingStore] = useState(false);
  const [newCat, setNewCat] = useState("");

  useEffect(() => { if (data?.store) setStore((s) => ({ ...s, ...data.store })); }, [data]);

  const saveStore = async () => {
    setSavingStore(true);
    try { await saveSetting("store", store); toast.success("Pengaturan tersimpan"); }
    catch (e) { toast.error(e.message); }
    finally { setSavingStore(false); }
  };

  const addCat = async () => {
    if (!newCat) return;
    try { await createCategory({ name: newCat }); setNewCat(""); toast.success("Kategori ditambahkan"); reload(); }
    catch (e) { toast.error(e.message); }
  };
  const delCat = async (c) => {
    if (!window.confirm(`Hapus kategori "${c.name}"?`)) return;
    try { await deleteCategory(c.id); toast.success("Kategori dihapus"); reload(); }
    catch (e) { toast.error(e.message); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="settings-page">
      <PageHeader title="Pengaturan" subtitle="Profil toko, kategori, dan log aktivitas." />
      <Tabs defaultValue="store">
        <TabsList className="bg-[#FFF5F8]">
          <TabsTrigger value="store" data-testid="settings-tab-store">Profil Toko</TabsTrigger>
          <TabsTrigger value="categories" data-testid="settings-tab-categories">Kategori</TabsTrigger>
          <TabsTrigger value="audit" data-testid="settings-tab-audit">Log Aktivitas</TabsTrigger>
        </TabsList>

        <TabsContent value="store" className="mt-4">
          <SectionCard title="Profil Toko">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nama Toko"><TextInput value={store.name || ""} onChange={(e) => setStore({ ...store, name: e.target.value })} data-testid="store-name-input" /></Field>
              <Field label="Telepon"><TextInput value={store.phone || ""} onChange={(e) => setStore({ ...store, phone: e.target.value })} /></Field>
              <Field label="Email"><TextInput value={store.email || ""} onChange={(e) => setStore({ ...store, email: e.target.value })} /></Field>
              <Field label="Alamat"><TextInput value={store.address || ""} onChange={(e) => setStore({ ...store, address: e.target.value })} /></Field>
              <Field label="Syarat & Ketentuan" className="sm:col-span-2"><TextArea value={store.terms || ""} onChange={(e) => setStore({ ...store, terms: e.target.value })} /></Field>
            </div>
            <div className="mt-4"><Btn onClick={saveStore} loading={savingStore} data-testid="store-save-btn"><Save className="h-4 w-4" /> Simpan</Btn></div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <SectionCard title="Kategori Produk">
            <div className="flex gap-2 mb-4">
              <TextInput value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nama kategori baru" data-testid="category-input" />
              <Btn onClick={addCat} data-testid="category-add-btn"><Plus className="h-4 w-4" /> Tambah</Btn>
            </div>
            {data.categories.length === 0 ? <EmptyState title="Belum ada kategori" /> : (
              <div className="flex flex-wrap gap-2">
                {data.categories.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-2 rounded-full bg-[#FFF5F8] border border-[#F8D7E3] px-3 py-1.5 text-sm text-[#1F191E]" data-testid={`category-${c.id}`}>
                    {c.name}
                    <button onClick={() => delCat(c)} className="text-[#B91C1C]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <SectionCard title="Log Aktivitas Terbaru">
            {data.logs.length === 0 ? <EmptyState title="Belum ada aktivitas" /> : (
              <Table>
                <thead><tr><Th>Waktu</Th><Th>Aksi</Th><Th>Entitas</Th><Th>Deskripsi</Th></tr></thead>
                <tbody>{data.logs.map((l) => (
                  <tr key={l.id}><Td className="text-xs">{formatDateTime(l.created_at)}</Td><Td><span className="text-xs font-semibold text-[#6D28D9]">{l.action}</span></Td><Td className="text-xs">{l.entity_type}</Td><Td>{l.description}</Td></tr>
                ))}</tbody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
