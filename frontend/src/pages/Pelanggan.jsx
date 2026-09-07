import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "@/lib/hooks";
import { listCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/api";
import { formatDateShort } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState } from "@/components/common";
import { Field, TextInput, TextArea, NativeSelect, Btn, Modal, SearchInput, Table, Th, Td } from "@/components/form";
import { Plus, Pencil, Trash2, Eye, Ruler } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "", phone: "", whatsapp: "", email: "", address: "", gender: "P", birth_date: "", notes: "",
  lingkar_dada: "", lingkar_perut: "", lingkar_lengan: "", lingkar_ketiak: "",
  tinggi_badan: "", berat_badan: "", panjang_badan: "", panjang_lengan: "", measurement_notes: "",
};
const numFields = ["lingkar_dada", "lingkar_perut", "lingkar_lengan", "lingkar_ketiak", "tinggi_badan", "berat_badan", "panjang_badan", "panjang_lengan"];

export default function Pelanggan() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(listCustomers, []);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const customers = useMemo(() => data || [], [data]);
  const filtered = useMemo(
    () => customers.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search)),
    [customers, search]
  );

  const openEdit = (c) => {
    const f = { ...empty, ...c };
    numFields.forEach((k) => (f[k] = c[k] ?? ""));
    f.birth_date = c.birth_date || "";
    setForm(f);
    setModal("edit");
  };

  const save = async () => {
    if (!form.name) { toast.error("Nama wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      numFields.forEach((k) => (payload[k] = form[k] === "" ? null : Number(form[k])));
      payload.birth_date = form.birth_date || null;
      if (!payload.customer_code) delete payload.customer_code;
      delete payload.created_at; delete payload.updated_at; delete payload.id;
      if (modal === "edit") await updateCustomer(form.id, payload);
      else {
        payload.customer_code = "CST-" + Date.now().toString().slice(-6);
        await createCustomer(payload);
      }
      toast.success("Pelanggan tersimpan");
      setModal(null); reload();
    } catch (e) { toast.error(e.message || "Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Hapus pelanggan "${c.name}"?`)) return;
    try { await deleteCustomer(c.id); toast.success("Pelanggan dihapus"); reload(); }
    catch (e) { toast.error(e.message || "Gagal menghapus (mungkin masih punya transaksi)"); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="pelanggan-page">
      <PageHeader
        title="Data Pelanggan"
        subtitle={`${customers.length} pelanggan`}
        actions={<Btn onClick={() => { setForm(empty); setModal("create"); }} data-testid="customer-add-btn"><Plus className="h-4 w-4" /> Tambah Pelanggan</Btn>}
      />

      <SectionCard>
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Cari nama / telepon…" testid="customer-search" /></div>
        {filtered.length === 0 ? <EmptyState title="Belum ada pelanggan" /> : (
          <Table>
            <thead><tr><Th>Kode</Th><Th>Nama</Th><Th>Kontak</Th><Th>Alamat</Th><Th>Terdaftar</Th><Th className="text-right">Aksi</Th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#FEFCFD]" data-testid={`customer-row-${c.id}`}>
                  <Td className="font-mono text-xs">{c.customer_code}</Td>
                  <Td className="font-medium text-[#1F191E]">{c.name}</Td>
                  <Td>{c.phone || c.whatsapp || "-"}</Td>
                  <Td className="max-w-[220px] truncate">{c.address || "-"}</Td>
                  <Td>{formatDateShort(c.created_at)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Btn variant="ghost" className="px-2 py-1.5" onClick={() => navigate(`/pelanggan/${c.id}`)} data-testid={`customer-view-${c.id}`}><Eye className="h-4 w-4" /></Btn>
                      <Btn variant="ghost" className="px-2 py-1.5" onClick={() => openEdit(c)} data-testid={`customer-edit-${c.id}`}><Pencil className="h-4 w-4" /></Btn>
                      <Btn variant="ghost" className="px-2 py-1.5 text-[#B91C1C]" onClick={() => remove(c)} data-testid={`customer-delete-${c.id}`}><Trash2 className="h-4 w-4" /></Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal
        open={!!modal} onClose={() => setModal(null)}
        title={modal === "edit" ? "Edit Pelanggan" : "Tambah Pelanggan"} size="lg"
        footer={<><Btn variant="outline" onClick={() => setModal(null)}>Batal</Btn><Btn onClick={save} loading={saving} data-testid="customer-save-btn">Simpan</Btn></>}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nama Lengkap" required className="sm:col-span-2"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="customer-name-input" /></Field>
          <Field label="No. WhatsApp"><TextInput value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} data-testid="customer-whatsapp-input" /></Field>
          <Field label="No. Telepon"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Jenis Kelamin"><NativeSelect value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: "P", label: "Perempuan" }, { value: "L", label: "Laki-laki" }]} /></Field>
          <Field label="Tanggal Lahir"><TextInput type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></Field>
          <Field label="Alamat" className="sm:col-span-2"><TextArea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </div>

        <div className="mt-5 pt-5 border-t border-[#FCE4EC]">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#E83E8C] mb-3"><Ruler className="h-4 w-4" /> Ukuran Badan (cm/kg)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Lingkar Dada"><TextInput type="number" value={form.lingkar_dada} onChange={(e) => setForm({ ...form, lingkar_dada: e.target.value })} data-testid="customer-lingkar-dada" /></Field>
            <Field label="Lingkar Perut"><TextInput type="number" value={form.lingkar_perut} onChange={(e) => setForm({ ...form, lingkar_perut: e.target.value })} /></Field>
            <Field label="Lingkar Lengan"><TextInput type="number" value={form.lingkar_lengan} onChange={(e) => setForm({ ...form, lingkar_lengan: e.target.value })} /></Field>
            <Field label="Lingkar Ketiak"><TextInput type="number" value={form.lingkar_ketiak} onChange={(e) => setForm({ ...form, lingkar_ketiak: e.target.value })} /></Field>
            <Field label="Tinggi Badan"><TextInput type="number" value={form.tinggi_badan} onChange={(e) => setForm({ ...form, tinggi_badan: e.target.value })} /></Field>
            <Field label="Berat Badan"><TextInput type="number" value={form.berat_badan} onChange={(e) => setForm({ ...form, berat_badan: e.target.value })} /></Field>
            <Field label="Panjang Badan"><TextInput type="number" value={form.panjang_badan} onChange={(e) => setForm({ ...form, panjang_badan: e.target.value })} /></Field>
            <Field label="Panjang Lengan"><TextInput type="number" value={form.panjang_lengan} onChange={(e) => setForm({ ...form, panjang_lengan: e.target.value })} /></Field>
          </div>
          <Field label="Catatan Ukuran" className="mt-3"><TextArea value={form.measurement_notes} onChange={(e) => setForm({ ...form, measurement_notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
