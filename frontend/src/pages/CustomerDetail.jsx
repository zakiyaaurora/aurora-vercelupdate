import { useParams, useNavigate } from "react-router-dom";
import { useAsync } from "@/lib/hooks";
import { getCustomer, customerHistory } from "@/lib/api";
import { formatRupiah, formatDateShort } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState, StatCard, StatusBadge } from "@/components/common";
import { Btn, Table, Th, Td } from "@/components/form";
import { ArrowLeft, User, Ruler, ShoppingBag, Wallet, FileText } from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(async () => {
    const [customer, history] = await Promise.all([getCustomer(id), customerHistory(id)]);
    return { customer, history };
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const c = data.customer;
  const h = data.history;
  const totalPaid = (h.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const outstanding = (h.invoices || []).reduce((s, i) => s + Number(i.remaining || 0), 0);

  const measurements = [
    ["Lingkar Dada", c.lingkar_dada], ["Lingkar Perut", c.lingkar_perut],
    ["Lingkar Lengan", c.lingkar_lengan], ["Lingkar Ketiak", c.lingkar_ketiak],
    ["Tinggi Badan", c.tinggi_badan], ["Berat Badan", c.berat_badan],
    ["Panjang Badan", c.panjang_badan], ["Panjang Lengan", c.panjang_lengan],
  ];

  return (
    <div data-testid="customer-detail-page">
      <button onClick={() => navigate("/pelanggan")} className="flex items-center gap-1.5 text-sm text-[#7A6A75] hover:text-[#E83E8C] mb-4" data-testid="customer-back-btn">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </button>
      <PageHeader title={c.name} subtitle={`${c.customer_code} · ${c.phone || c.whatsapp || "-"}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Booking" value={h.bookings.length} icon={ShoppingBag} tone="purple" />
        <StatCard label="Total Rental" value={h.rentals.length} icon={ShoppingBag} tone="amber" />
        <StatCard label="Total Dibayar" value={formatRupiah(totalPaid)} icon={Wallet} tone="green" />
        <StatCard label="Outstanding" value={formatRupiah(outstanding)} icon={FileText} tone="red" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <SectionCard title="Profil" testid="customer-profile">
          <div className="space-y-2.5 text-sm">
            <Row icon={User} label="Nama" value={c.name} />
            <Row label="Email" value={c.email || "-"} />
            <Row label="WhatsApp" value={c.whatsapp || "-"} />
            <Row label="Telepon" value={c.phone || "-"} />
            <Row label="Alamat" value={c.address || "-"} />
            <Row label="Gender" value={c.gender === "L" ? "Laki-laki" : "Perempuan"} />
            {c.notes && <Row label="Catatan" value={c.notes} />}
          </div>
        </SectionCard>

        <SectionCard title="Ukuran Badan" className="lg:col-span-2" testid="customer-measurements">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {measurements.map(([label, val]) => (
              <div key={label} className="rounded-lg bg-[#FFF5F8] border border-[#F8D7E3] p-3">
                <p className="text-[11px] text-[#7A6A75]">{label}</p>
                <p className="text-lg font-bold text-[#1F191E] flex items-center gap-1"><Ruler className="h-3.5 w-3.5 text-[#E83E8C]" /> {val ?? "-"}</p>
              </div>
            ))}
          </div>
          {c.measurement_notes && <p className="mt-3 text-sm text-[#7A6A75]">Catatan: {c.measurement_notes}</p>}
        </SectionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <SectionCard title="Riwayat Booking" testid="customer-bookings">
          {h.bookings.length === 0 ? <EmptyState title="Belum ada booking" /> : (
            <Table>
              <thead><tr><Th>No.</Th><Th>Tanggal</Th><Th>Total</Th><Th>Status</Th></tr></thead>
              <tbody>{h.bookings.map((b) => (
                <tr key={b.id}><Td className="font-mono text-xs">{b.booking_number}</Td><Td>{formatDateShort(b.start_date)}</Td><Td>{formatRupiah(b.total)}</Td><Td><StatusBadge status={b.status} /></Td></tr>
              ))}</tbody>
            </Table>
          )}
        </SectionCard>

        <SectionCard title="Riwayat Pembayaran" testid="customer-payments">
          {h.payments.length === 0 ? <EmptyState title="Belum ada pembayaran" /> : (
            <Table>
              <thead><tr><Th>No.</Th><Th>Tanggal</Th><Th>Metode</Th><Th>Jumlah</Th></tr></thead>
              <tbody>{h.payments.map((p) => (
                <tr key={p.id}><Td className="font-mono text-xs">{p.payment_number}</Td><Td>{formatDateShort(p.payment_date)}</Td><Td>{p.payment_method}</Td><Td className="font-semibold text-[#047857]">{formatRupiah(p.amount)}</Td></tr>
              ))}</tbody>
            </Table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-[#7A6A75] w-24 shrink-0 flex items-center gap-1">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>
      <span className="text-[#1F191E] font-medium">{value}</span>
    </div>
  );
}
