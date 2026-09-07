import { useState } from "react";
import { useAsync } from "@/lib/hooks";
import { listUsers, createUser, updateUser, deleteUser } from "@/lib/api";
import { formatDateShort } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState, StatusBadge } from "@/components/common";
import { Field, TextInput, NativeSelect, Btn, Modal, Table, Th, Td } from "@/components/form";
import { ROLES } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

export default function Pengguna() {
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useAsync(listUsers, []);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "STAFF" });
  const [saving, setSaving] = useState(false);

  const users = data || [];

  const save = async () => {
    if (!form.email || !form.password || !form.name) { toast.error("Nama, email, dan password wajib diisi"); return; }
    if (form.password.length < 6) { toast.error("Password minimal 6 karakter"); return; }
    setSaving(true);
    try {
      await createUser(form);
      toast.success("Pengguna dibuat. Jika belum muncul, tunggu beberapa detik lalu refresh.");
      setModal(false); setForm({ name: "", email: "", password: "", phone: "", role: "STAFF" });
      setTimeout(reload, 1200);
    } catch (e) { toast.error(e.message || "Gagal membuat pengguna"); }
    finally { setSaving(false); }
  };

  const changeRole = async (u, role) => {
    try { await updateUser(u.id, { role }); toast.success("Role diperbarui"); reload(); }
    catch (e) { toast.error(e.message); }
  };
  const changeStatus = async (u) => {
    const next = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try { await updateUser(u.id, { status: next }); toast.success("Status diperbarui"); reload(); }
    catch (e) { toast.error(e.message); }
  };
  const remove = async (u) => {
    if (u.id === me?.id) { toast.error("Tidak dapat menghapus akun sendiri"); return; }
    if (!window.confirm(`Hapus profil ${u.name}?`)) return;
    try { await deleteUser(u.id); toast.success("Profil dihapus"); reload(); }
    catch (e) { toast.error(e.message); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="pengguna-page">
      <PageHeader title="Manajemen Pengguna" subtitle={`${users.length} pengguna`}
        actions={<Btn onClick={() => setModal(true)} data-testid="user-add-btn"><Plus className="h-4 w-4" /> Tambah Pengguna</Btn>} />

      <SectionCard>
        {users.length === 0 ? <EmptyState title="Belum ada pengguna" /> : (
          <Table>
            <thead><tr><Th>Nama</Th><Th>Email</Th><Th>Telepon</Th><Th>Role</Th><Th>Status</Th><Th>Dibuat</Th><Th className="text-right">Aksi</Th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#FEFCFD]" data-testid={`user-row-${u.id}`}>
                  <Td className="font-medium text-[#1F191E]">{u.name} {u.id === me?.id && <span className="text-[10px] text-[#E83E8C]">(Anda)</span>}</Td>
                  <Td>{u.email}</Td>
                  <Td>{u.phone || "-"}</Td>
                  <Td>
                    <NativeSelect value={u.role} onChange={(e) => changeRole(u, e.target.value)} options={ROLES} className="w-28 py-1" data-testid={`user-role-${u.id}`} />
                  </Td>
                  <Td><button onClick={() => changeStatus(u)}><StatusBadge status={u.status === "ACTIVE" ? "AVAILABLE" : "INACTIVE"} /></button></Td>
                  <Td className="text-xs">{formatDateShort(u.created_at)}</Td>
                  <Td><div className="flex justify-end"><Btn variant="ghost" className="px-2 py-1.5 text-[#B91C1C]" onClick={() => remove(u)} data-testid={`user-delete-${u.id}`}><Trash2 className="h-4 w-4" /></Btn></div></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal open={modal} onClose={() => setModal(false)} title="Tambah Pengguna"
        footer={<><Btn variant="outline" onClick={() => setModal(false)}>Batal</Btn><Btn onClick={save} loading={saving} data-testid="user-save-btn">Buat Pengguna</Btn></>}>
        <div className="space-y-4">
          <Field label="Nama Lengkap" required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input" /></Field>
          <Field label="Email" required><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input" /></Field>
          <Field label="Password" required><TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimal 6 karakter" data-testid="user-password-input" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Telepon"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Role"><NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLES} data-testid="user-role-select" /></Field>
          </div>
          <p className="text-xs text-[#7A6A75] flex items-start gap-1.5"><UserCog className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Pengguna dibuat via Supabase Auth. Pastikan konfirmasi email dinonaktifkan di Supabase agar bisa langsung login.</p>
        </div>
      </Modal>
    </div>
  );
}
