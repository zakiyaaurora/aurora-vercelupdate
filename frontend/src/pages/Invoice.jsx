import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import { listInvoices, getInvoice, getSetting } from "@/lib/api";
import { formatRupiah, formatDate, formatDateShort } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState, StatusBadge } from "@/components/common";
import { Btn, Modal, SearchInput, Table, Th, Td, NativeSelect } from "@/components/form";
import { Eye, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Invoice() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [invoices, store] = await Promise.all([listInvoices(), getSetting("store").catch(() => null)]);
    return { invoices, store: store?.value };
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState(null);

  const invoices = useMemo(() => data?.invoices || [], [data]);
  const store = data?.store || { name: "AURORA SEWA KEBAYA" };

  const filtered = useMemo(() => invoices.filter((i) => {
    const okS = !search || (i.invoice_number || "").toLowerCase().includes(search.toLowerCase()) || (i.customer?.name || "").toLowerCase().includes(search.toLowerCase());
    const okF = !statusFilter || i.status === statusFilter;
    return okS && okF;
  }), [invoices, search, statusFilter]);

  const view = async (i) => { try { setDetail(await getInvoice(i.id)); } catch (e) { toast.error(e.message); } };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="invoice-page">
      <PageHeader title="Invoice" subtitle={`${invoices.length} invoice`} />
      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nomor / pelanggan…" testid="invoice-search" />
          <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="Semua Status" options={["UNPAID", "PARTIAL", "PAID", "CANCELLED"]} className="sm:w-48" />
        </div>
        {filtered.length === 0 ? <EmptyState title="Belum ada invoice" /> : (
          <Table>
            <thead><tr><Th>No.</Th><Th>Pelanggan</Th><Th>Tanggal</Th><Th>Total</Th><Th>Dibayar</Th><Th>Sisa</Th><Th>Status</Th><Th className="text-right">Aksi</Th></tr></thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="hover:bg-[#FEFCFD]" data-testid={`invoice-row-${i.id}`}>
                  <Td className="font-mono text-xs">{i.invoice_number}</Td>
                  <Td className="font-medium text-[#1F191E]">{i.customer?.name || "-"}</Td>
                  <Td className="text-xs">{formatDateShort(i.invoice_date)}</Td>
                  <Td className="font-semibold">{formatRupiah(i.total)}</Td>
                  <Td className="text-[#047857]">{formatRupiah(i.paid)}</Td>
                  <Td className="text-[#B91C1C]">{formatRupiah(i.remaining)}</Td>
                  <Td><StatusBadge status={i.status} /></Td>
                  <Td><div className="flex justify-end"><Btn variant="secondary" className="px-2.5 py-1.5" onClick={() => view(i)} data-testid={`invoice-view-${i.id}`}><Eye className="h-4 w-4" /> Lihat</Btn></div></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Invoice" size="lg"
        footer={<><Btn variant="outline" onClick={() => setDetail(null)}>Tutup</Btn><Btn onClick={() => window.print()} data-testid="invoice-print-btn"><Printer className="h-4 w-4" /> Cetak / PDF</Btn></>}>
        {detail && (
          <div id="invoice-print" className="text-sm text-[#1F191E]">
            <div className="flex items-start justify-between border-b-2 border-[#E83E8C] pb-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#E83E8C] grid place-items-center text-white"><Sparkles className="h-6 w-6" /></div>
                <div>
                  <p className="text-xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{store.name}</p>
                  <p className="text-xs text-[#7A6A75]">{store.address} {store.phone && `· ${store.phone}`}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#E83E8C]">INVOICE</p>
                <p className="font-mono text-xs">{detail.invoice_number}</p>
                <div className="mt-1"><StatusBadge status={detail.status} /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-xs text-[#7A6A75] uppercase">Ditagihkan Kepada</p>
                <p className="font-semibold">{detail.customer?.name}</p>
                <p className="text-xs text-[#7A6A75]">{detail.customer?.phone || detail.customer?.whatsapp}</p>
                <p className="text-xs text-[#7A6A75]">{detail.customer?.address}</p>
              </div>
              <div className="text-right">
                <p className="text-xs"><span className="text-[#7A6A75]">Tanggal: </span>{formatDate(detail.invoice_date)}</p>
                <p className="text-xs"><span className="text-[#7A6A75]">Jatuh Tempo: </span>{formatDate(detail.due_date)}</p>
              </div>
            </div>

            <table className="w-full mt-4 border-collapse">
              <thead><tr className="border-b border-[#FCE4EC]"><th className="text-left py-2 text-xs uppercase text-[#7A6A75]">Item</th><th className="text-center py-2 text-xs uppercase text-[#7A6A75]">Qty</th><th className="text-right py-2 text-xs uppercase text-[#7A6A75]">Harga</th><th className="text-right py-2 text-xs uppercase text-[#7A6A75]">Subtotal</th></tr></thead>
              <tbody>
                {(detail.booking?.items || []).map((it) => (
                  <tr key={it.id} className="border-b border-[#FCE4EC]">
                    <td className="py-2">{it.product?.name}</td>
                    <td className="py-2 text-center">{it.quantity}</td>
                    <td className="py-2 text-right">{formatRupiah(it.rental_price)}</td>
                    <td className="py-2 text-right">{formatRupiah(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mt-4">
              <div className="w-64 space-y-1.5 text-sm">
                <Line label="Subtotal" value={formatRupiah(detail.subtotal)} />
                <Line label="Diskon" value={`- ${formatRupiah(detail.discount)}`} />
                {detail.deposit > 0 && <Line label="Deposit" value={formatRupiah(detail.deposit)} />}
                <div className="border-t border-[#FCE4EC] pt-1.5"><Line label="Total" value={formatRupiah(detail.total)} bold /></div>
                <Line label="Dibayar" value={formatRupiah(detail.paid)} green />
                <Line label="Sisa" value={formatRupiah(detail.remaining)} red bold />
              </div>
            </div>

            {store.terms && <p className="mt-6 text-[11px] text-[#7A6A75] border-t border-[#FCE4EC] pt-3">Syarat & Ketentuan: {store.terms}</p>}
            <div className="mt-8 flex justify-between text-xs text-[#7A6A75]">
              <div className="text-center"><div className="h-12" /><p className="border-t border-[#B79BAA] pt-1 px-6">Penyewa</p></div>
              <div className="text-center"><div className="h-12" /><p className="border-t border-[#B79BAA] pt-1 px-6">Aurora Sewa Kebaya</p></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Line({ label, value, bold, green, red }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#7A6A75]">{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${green ? "text-[#047857]" : ""} ${red ? "text-[#B91C1C]" : "text-[#1F191E]"}`}>{value}</span>
    </div>
  );
}
