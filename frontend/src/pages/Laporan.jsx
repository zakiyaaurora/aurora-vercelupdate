import { useState } from "react";
import { reportPayments, reportBookings, reportRentals } from "@/lib/api";
import { formatRupiah, formatDateShort, todayISO, addDays } from "@/lib/format";
import { PageHeader, SectionCard, EmptyState, StatCard, StatusBadge } from "@/components/common";
import { Field, TextInput, NativeSelect, Btn, Table, Th, Td } from "@/components/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3, Download, Wallet, ShoppingBag, Clock } from "lucide-react";
import { toast } from "sonner";

const csvExport = (rows, headers, filename) => {
  if (!rows.length) { toast.error("Tidak ada data untuk diekspor"); return; }
  const lines = [headers.map((h) => h.label).join(",")];
  rows.forEach((r) => lines.push(headers.map((h) => `"${String(h.get(r) ?? "").replace(/"/g, '""')}"`).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function Laporan() {
  const [range, setRange] = useState({ start: addDays(todayISO(), -30), end: todayISO() });
  const [tab, setTab] = useState("payments");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const preset = (days) => setRange({ start: addDays(todayISO(), -days), end: todayISO() });

  const run = async () => {
    setLoading(true);
    try {
      let data = [];
      if (tab === "payments") data = await reportPayments(range.start, range.end);
      else if (tab === "bookings") data = await reportBookings(range.start, range.end);
      else data = await reportRentals(range.start, range.end);
      setRows(data);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const totalRevenue = tab === "payments" ? rows.filter((r) => r.payment_type !== "REFUND").reduce((s, r) => s + Number(r.amount || 0), 0) : 0;
  const totalValue = (tab === "bookings" || tab === "rentals") ? rows.reduce((s, r) => s + Number(r.total || 0), 0) : 0;

  const exportCsv = () => {
    if (tab === "payments") csvExport(rows, [
      { label: "No", get: (r) => r.payment_number }, { label: "Tanggal", get: (r) => r.payment_date },
      { label: "Pelanggan", get: (r) => r.customer?.name }, { label: "Metode", get: (r) => r.payment_method },
      { label: "Tipe", get: (r) => r.payment_type }, { label: "Jumlah", get: (r) => r.amount },
    ], "laporan-pembayaran.csv");
    else if (tab === "bookings") csvExport(rows, [
      { label: "No", get: (r) => r.booking_number }, { label: "Tanggal", get: (r) => r.booking_date },
      { label: "Pelanggan", get: (r) => r.customer?.name }, { label: "Status", get: (r) => r.status },
      { label: "Total", get: (r) => r.total },
    ], "laporan-booking.csv");
    else csvExport(rows, [
      { label: "No", get: (r) => r.rental_number }, { label: "Keluar", get: (r) => r.pickup_date },
      { label: "Pelanggan", get: (r) => r.customer?.name }, { label: "Status", get: (r) => r.status },
      { label: "Total", get: (r) => r.total },
    ], "laporan-rental.csv");
  };

  return (
    <div data-testid="laporan-page">
      <PageHeader title="Laporan" subtitle="Analisis pendapatan, booking, dan rental." />

      <SectionCard className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <Field label="Dari"><TextInput type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} data-testid="report-start" /></Field>
          <Field label="Sampai"><TextInput type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} data-testid="report-end" /></Field>
          <div className="flex gap-2">
            <Btn variant="outline" className="py-2" onClick={() => preset(7)}>7 Hari</Btn>
            <Btn variant="outline" className="py-2" onClick={() => preset(30)}>30 Hari</Btn>
            <Btn variant="outline" className="py-2" onClick={() => preset(365)}>1 Tahun</Btn>
          </div>
          <div className="flex-1" />
          <Btn onClick={run} loading={loading} data-testid="report-run"><BarChart3 className="h-4 w-4" /> Tampilkan</Btn>
          <Btn variant="secondary" onClick={exportCsv} data-testid="report-export"><Download className="h-4 w-4" /> Export CSV</Btn>
        </div>
      </SectionCard>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setRows([]); }}>
        <TabsList className="bg-[#FFF5F8]">
          <TabsTrigger value="payments" data-testid="report-tab-payments">Pendapatan</TabsTrigger>
          <TabsTrigger value="bookings" data-testid="report-tab-bookings">Booking</TabsTrigger>
          <TabsTrigger value="rentals" data-testid="report-tab-rentals">Rental</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatCard label="Total Pendapatan" value={formatRupiah(totalRevenue)} icon={Wallet} tone="green" />
            <StatCard label="Jumlah Transaksi" value={rows.length} icon={Wallet} tone="pink" />
          </div>
          {rows.length === 0 ? <SectionCard><EmptyState title="Belum ada data" subtitle="Klik Tampilkan untuk memuat laporan." /></SectionCard> : (
            <SectionCard><Table>
              <thead><tr><Th>No.</Th><Th>Tanggal</Th><Th>Pelanggan</Th><Th>Metode</Th><Th className="text-right">Jumlah</Th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}><Td className="font-mono text-xs">{r.payment_number}</Td><Td>{formatDateShort(r.payment_date)}</Td><Td>{r.customer?.name}</Td><Td>{r.payment_method}</Td><Td className="text-right font-semibold text-[#047857]">{formatRupiah(r.amount)}</Td></tr>
              ))}</tbody>
            </Table></SectionCard>
          )}
        </TabsContent>

        <TabsContent value="bookings" className="mt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatCard label="Total Nilai" value={formatRupiah(totalValue)} icon={ShoppingBag} tone="purple" />
            <StatCard label="Jumlah Booking" value={rows.length} icon={ShoppingBag} tone="pink" />
          </div>
          {rows.length === 0 ? <SectionCard><EmptyState title="Belum ada data" /></SectionCard> : (
            <SectionCard><Table>
              <thead><tr><Th>No.</Th><Th>Tanggal</Th><Th>Pelanggan</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}><Td className="font-mono text-xs">{r.booking_number}</Td><Td>{formatDateShort(r.booking_date)}</Td><Td>{r.customer?.name}</Td><Td><StatusBadge status={r.status} /></Td><Td className="text-right font-semibold">{formatRupiah(r.total)}</Td></tr>
              ))}</tbody>
            </Table></SectionCard>
          )}
        </TabsContent>

        <TabsContent value="rentals" className="mt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatCard label="Total Nilai" value={formatRupiah(totalValue)} icon={Clock} tone="amber" />
            <StatCard label="Jumlah Rental" value={rows.length} icon={Clock} tone="pink" />
          </div>
          {rows.length === 0 ? <SectionCard><EmptyState title="Belum ada data" /></SectionCard> : (
            <SectionCard><Table>
              <thead><tr><Th>No.</Th><Th>Keluar</Th><Th>Pelanggan</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}><Td className="font-mono text-xs">{r.rental_number}</Td><Td>{formatDateShort(r.pickup_date)}</Td><Td>{r.customer?.name}</Td><Td><StatusBadge status={r.status} /></Td><Td className="text-right font-semibold">{formatRupiah(r.total)}</Td></tr>
              ))}</tbody>
            </Table></SectionCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
