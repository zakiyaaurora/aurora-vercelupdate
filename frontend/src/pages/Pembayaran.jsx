import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import { listPayments, listInvoices, addPayment } from "@/lib/api";
import { formatRupiah, formatDateShort, formatDateTime } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState, StatusBadge, StatCard } from "@/components/common";
import { Field, TextInput, NativeSelect, Btn, Modal, SearchInput, Table, Th, Td } from "@/components/form";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/constants";
import { Wallet, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Pembayaran() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [payments, invoices] = await Promise.all([listPayments(), listInvoices()]);
    return { payments, invoices };
  }, []);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ invoice_id: "", amount: "", payment_method: "CASH", payment_type: "PARTIAL", reference_number: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const payments = useMemo(() => data?.payments || [], [data]);
  const invoices = data?.invoices || [];
  const unpaid = invoices.filter((i) => ["UNPAID", "PARTIAL"].includes(i.status));

  const filtered = useMemo(() => payments.filter((p) => !search || (p.payment_number || "").toLowerCase().includes(search.toLowerCase()) || (p.customer?.name || "").toLowerCase().includes(search.toLowerCase())), [payments, search]);
  const totalIn = payments.filter((p) => p.payment_type !== "REFUND").reduce((s, p) => s + Number(p.amount || 0), 0);
  const receivable = unpaid.reduce((s, i) => s + Number(i.remaining || 0), 0);

  const selectedInvoice = invoices.find((i) => i.id === form.invoice_id);

  const save = async () => {
    if (!form.invoice_id) { toast.error("Pilih invoice"); return; }
    if (Number(form.amount) <= 0) { toast.error("Jumlah harus lebih dari 0"); return; }
    setSaving(true);
    try {
      await addPayment({ ...form, amount: Number(form.amount) });
      toast.success("Pembayaran tercatat");
      setModal(false); setForm({ invoice_id: "", amount: "", payment_method: "CASH", payment_type: "PARTIAL", reference_number: "", notes: "" });
      reload();
    } catch (e) { toast.error(e.message || "Gagal mencatat pembayaran"); }
    finally { setSaving(false); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="pembayaran-page">
      <PageHeader title="Pembayaran" subtitle={`${payments.length} transaksi pembayaran`}
        actions={<Btn onClick={() => setModal(true)} data-testid="payment-add-btn"><Plus className="h-4 w-4" /> Catat Pembayaran</Btn>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Pemasukan" value={formatRupiah(totalIn)} icon={Wallet} tone="green" />
        <StatCard label="Total Piutang" value={formatRupiah(receivable)} icon={Wallet} tone="red" />
        <StatCard label="Invoice Belum Lunas" value={unpaid.length} icon={Wallet} tone="amber" />
      </div>

      <SectionCard>
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Cari nomor / pelanggan…" testid="payment-search" /></div>
        {filtered.length === 0 ? <EmptyState title="Belum ada pembayaran" /> : (
          <Table>
            <thead><tr><Th>No.</Th><Th>Invoice</Th><Th>Pelanggan</Th><Th>Metode</Th><Th>Tipe</Th><Th>Tanggal</Th><Th className="text-right">Jumlah</Th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-[#FEFCFD]" data-testid={`payment-row-${p.id}`}>
                  <Td className="font-mono text-xs">{p.payment_number}</Td>
                  <Td className="font-mono text-xs">{p.invoice?.invoice_number || "-"}</Td>
                  <Td className="font-medium text-[#1F191E]">{p.customer?.name || "-"}</Td>
                  <Td>{p.payment_method}</Td>
                  <Td className="text-xs">{p.payment_type}</Td>
                  <Td className="text-xs">{formatDateShort(p.payment_date)}</Td>
                  <Td className="text-right font-semibold text-[#047857]">{formatRupiah(p.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal open={modal} onClose={() => setModal(false)} title="Catat Pembayaran"
        footer={<><Btn variant="outline" onClick={() => setModal(false)}>Batal</Btn><Btn onClick={save} loading={saving} data-testid="payment-save-btn">Simpan</Btn></>}>
        <div className="space-y-4">
          <Field label="Invoice" required><NativeSelect value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} placeholder="Pilih invoice belum lunas" options={unpaid.map((i) => ({ value: i.id, label: `${i.invoice_number} — ${i.customer?.name} (Sisa ${formatRupiah(i.remaining)})` }))} data-testid="payment-invoice-select" /></Field>
          {selectedInvoice && (
            <div className="rounded-lg bg-[#FFF5F8] border border-[#F8D7E3] p-3 text-sm flex justify-between">
              <span className="text-[#7A6A75]">Total {formatRupiah(selectedInvoice.total)} · Dibayar {formatRupiah(selectedInvoice.paid)}</span>
              <span className="font-semibold text-[#B91C1C]">Sisa {formatRupiah(selectedInvoice.remaining)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Jumlah" required><TextInput type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="payment-amount-input" /></Field>
            <Field label="Metode"><NativeSelect value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} options={PAYMENT_METHODS} /></Field>
            <Field label="Tipe"><NativeSelect value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })} options={PAYMENT_TYPES} /></Field>
            <Field label="No. Referensi"><TextInput value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
