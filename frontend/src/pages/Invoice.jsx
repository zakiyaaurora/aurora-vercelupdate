import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import { listInvoices, getInvoice, getSetting } from "@/lib/api";
import { formatRupiah, formatDate, formatDateShort } from "@/lib/format";
import {
  PageHeader,
  SectionCard,
  Loading,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "@/components/common";
import {
  Btn,
  Modal,
  SearchInput,
  Table,
  Th,
  Td,
  NativeSelect,
} from "@/components/form";
import { Eye, Printer, Sparkles, CalendarDays, User, Phone } from "lucide-react";
import { toast } from "sonner";

export default function Invoice() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [invoices, store] = await Promise.all([
      listInvoices(),
      getSetting("store").catch(() => null),
    ]);

    return {
      invoices,
      store: store?.value,
    };
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState(null);

  const invoices = useMemo(() => data?.invoices || [], [data]);

  const store = data?.store || {
    name: "AURORA SEWA KEBAYA",
  };

  const filtered = useMemo(
    () =>
      invoices.filter((i) => {
        const searchText = search.toLowerCase();

        const okS =
          !search ||
          (i.invoice_number || "").toLowerCase().includes(searchText) ||
          (i.customer?.name || "").toLowerCase().includes(searchText);

        const okF = !statusFilter || i.status === statusFilter;

        return okS && okF;
      }),
    [invoices, search, statusFilter]
  );

  const view = async (invoice) => {
    try {
      setDetail(await getInvoice(invoice.id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <Loading />;

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }

  return (
    <div data-testid="invoice-page">
      <PageHeader
        title="Invoice"
        subtitle={`${invoices.length} invoice`}
      />

      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nomor / pelanggan…"
            testid="invoice-search"
          />

          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Semua Status"
            options={[
              "UNPAID",
              "PARTIAL",
              "PAID",
              "CANCELLED",
            ]}
            className="sm:w-48"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Belum ada invoice" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>No.</Th>
                <Th>Pelanggan</Th>
                <Th>Tanggal</Th>
                <Th>Total</Th>
                <Th>Dibayar</Th>
                <Th>Sisa</Th>
                <Th>Status</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-[#FEFCFD]"
                  data-testid={`invoice-row-${invoice.id}`}
                >
                  <Td className="font-mono text-xs">
                    {invoice.invoice_number}
                  </Td>

                  <Td className="font-medium text-[#1F191E]">
                    {invoice.customer?.name || "-"}
                  </Td>

                  <Td className="text-xs">
                    {formatDateShort(invoice.invoice_date)}
                  </Td>

                  <Td className="font-semibold">
                    {formatRupiah(invoice.total)}
                  </Td>

                  <Td className="text-[#047857]">
                    {formatRupiah(invoice.paid)}
                  </Td>

                  <Td className="text-[#B91C1C]">
                    {formatRupiah(invoice.remaining)}
                  </Td>

                  <Td>
                    <StatusBadge status={invoice.status} />
                  </Td>

                  <Td>
                    <div className="flex justify-end">
                      <Btn
                        variant="secondary"
                        className="px-2.5 py-1.5"
                        onClick={() => view(invoice)}
                        data-testid={`invoice-view-${invoice.id}`}
                      >
                        <Eye className="h-4 w-4" />
                        Lihat
                      </Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Detail Invoice"
        size="lg"
        footer={
          <>
            <Btn
              variant="outline"
              onClick={() => setDetail(null)}
            >
              Tutup
            </Btn>

            <Btn
              onClick={() => window.print()}
              data-testid="invoice-print-btn"
            >
              <Printer className="h-4 w-4" />
              Cetak / PDF
            </Btn>
          </>
        }
      >
        {detail && (
          <>
            <style>
              {`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }

                  #invoice-print,
                  #invoice-print * {
                    visibility: visible !important;
                  }

                  #invoice-print {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 20px !important;
                    background: white !important;
                  }
                }
              `}
            </style>

            <div
              id="invoice-print"
              className="text-sm text-[#1F191E] bg-white"
            >
              {/* HEADER */}
              <div className="flex items-start justify-between border-b-2 border-[#E83E8C] pb-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-[#E83E8C] grid place-items-center text-white">
                    <Sparkles className="h-6 w-6" />
                  </div>

                  <div>
                    <p
                      className="text-2xl font-bold tracking-wide"
                      style={{
                        fontFamily:
                          "'Cormorant Garamond', serif",
                      }}
                    >
                      {store.name || "AURORA SEWA KEBAYA"}
                    </p>

                    {store.address && (
                      <p className="text-xs text-[#7A6A75] mt-1">
                        {store.address}
                      </p>
                    )}

                    {store.phone && (
                      <p className="text-xs text-[#7A6A75]">
                        Telp / WhatsApp: {store.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-[#E83E8C] tracking-wider">
                    INVOICE
                  </p>

                  <p className="font-mono text-xs mt-1">
                    {detail.invoice_number}
                  </p>

                  <div className="mt-2">
                    <StatusBadge status={detail.status} />
                  </div>
                </div>
              </div>

              {/* CUSTOMER + DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
                <div className="rounded-xl border border-[#FCE4EC] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A18895] mb-2">
                    Ditagihkan Kepada
                  </p>

                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-[#E83E8C] mt-0.5" />

                    <div>
                      <p className="font-semibold text-base">
                        {detail.customer?.name || "-"}
                      </p>

                      {(detail.customer?.phone ||
                        detail.customer?.whatsapp) && (
                        <div className="flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3 text-[#A18895]" />
                          <p className="text-xs text-[#7A6A75]">
                            {detail.customer?.phone ||
                              detail.customer?.whatsapp}
                          </p>
                        </div>
                      )}

                      {detail.customer?.address && (
                        <p className="text-xs text-[#7A6A75] mt-1">
                          {detail.customer.address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#FCE4EC] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A18895] mb-2">
                    Informasi Invoice
                  </p>

                  <InfoRow
                    label="Tanggal Invoice"
                    value={formatDate(detail.invoice_date)}
                  />

                  {detail.due_date && (
                    <InfoRow
                      label="Jatuh Tempo"
                      value={formatDate(detail.due_date)}
                    />
                  )}

                  <InfoRow
                    label="Status"
                    value={
                      <StatusBadge status={detail.status} />
                    }
                  />
                </div>
              </div>

              {/* RENTAL PERIOD */}
              {(detail.booking?.start_date ||
                detail.booking?.end_date ||
                detail.booking?.rental_date ||
                detail.booking?.return_date) && (
                <div className="mt-5 rounded-xl bg-[#FFF7FA] border border-[#FCE4EC] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="h-4 w-4 text-[#E83E8C]" />

                    <p className="font-semibold text-[#1F191E]">
                      Periode Sewa
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase text-[#A18895]">
                        Tanggal Mulai
                      </p>

                      <p className="font-semibold mt-1">
                        {formatDate(
                          detail.booking?.start_date ||
                            detail.booking?.rental_date
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase text-[#A18895]">
                        Tanggal Kembali
                      </p>

                      <p className="font-semibold mt-1">
                        {formatDate(
                          detail.booking?.end_date ||
                            detail.booking?.return_date
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ITEMS */}
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#7A6A75] mb-2">
                  Detail Barang Sewa
                </p>

                <div className="overflow-hidden rounded-xl border border-[#FCE4EC]">
                  <table className="w-full border-collapse">
                    <thead className="bg-[#FFF7FA]">
                      <tr>
                        <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-[#7A6A75]">
                          No
                        </th>

                        <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-[#7A6A75]">
                          Item
                        </th>

                        <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-[#7A6A75]">
                          Qty
                        </th>

                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-[#7A6A75]">
                          Harga
                        </th>

                        <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-[#7A6A75]">
                          Subtotal
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {(detail.booking?.items || []).map(
                        (item, index) => (
                          <tr
                            key={item.id}
                            className="border-t border-[#FCE4EC]"
                          >
                            <td className="px-4 py-3 text-xs text-[#7A6A75]">
                              {index + 1}
                            </td>

                            <td className="px-4 py-3">
                              <p className="font-medium">
                                {item.product?.name || "-"}
                              </p>

                              {item.product?.sku && (
                                <p className="text-[10px] text-[#A18895] mt-0.5">
                                  SKU: {item.product.sku}
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-3 text-center">
                              {item.quantity}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {formatRupiah(item.rental_price)}
                            </td>

                            <td className="px-4 py-3 text-right font-medium">
                              {formatRupiah(item.subtotal)}
                            </td>
                          </tr>
                        )
                      )}

                      {(detail.booking?.items || []).length === 0 && (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-4 py-5 text-center text-xs text-[#7A6A75]"
                          >
                            Tidak ada detail barang.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PAYMENT SUMMARY */}
              <div className="flex justify-end mt-6">
                <div className="w-full sm:w-80">
                  <div className="rounded-xl border border-[#FCE4EC] overflow-hidden">
                    <div className="bg-[#FFF7FA] px-4 py-3">
                      <p className="font-semibold">
                        Ringkasan Pembayaran
                      </p>
                    </div>

                    <div className="p-4 space-y-2.5">
                      <Line
                        label="Subtotal"
                        value={formatRupiah(detail.subtotal)}
                      />

                      <Line
                        label="Diskon"
                        value={`- ${formatRupiah(
                          detail.discount || 0
                        )}`}
                      />

                      {detail.deposit > 0 && (
                        <Line
                          label="Deposit"
                          value={formatRupiah(detail.deposit)}
                        />
                      )}

                      <div className="border-t border-[#FCE4EC] pt-3 mt-3">
                        <Line
                          label="TOTAL"
                          value={formatRupiah(detail.total)}
                          bold
                          large
                        />
                      </div>

                      <div className="pt-2">
                        <Line
                          label="Total Dibayar"
                          value={formatRupiah(detail.paid)}
                          green
                          bold
                        />

                        <div className="mt-2 rounded-lg bg-[#FFF5F5] px-3 py-2.5">
                          <Line
                            label="Sisa Pembayaran"
                            value={formatRupiah(detail.remaining)}
                            red
                            bold
                            large
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAYMENT STATUS NOTE */}
              <div className="mt-5 rounded-lg border border-[#FCE4EC] px-4 py-3">
                <p className="text-xs text-[#7A6A75]">
                  <span className="font-semibold text-[#1F191E]">
                    Status pembayaran:
                  </span>{" "}
                  {detail.status === "PAID"
                    ? "Pembayaran telah lunas."
                    : detail.status === "PARTIAL"
                    ? "Invoice telah menerima pembayaran sebagian. Sisa pembayaran masih harus dilunasi."
                    : detail.status === "CANCELLED"
                    ? "Invoice ini dibatalkan."
                    : "Invoice belum menerima pembayaran penuh."}
                </p>
              </div>

              {/* TERMS */}
              {store.terms && (
                <div className="mt-6 border-t border-[#FCE4EC] pt-4">
                  <p className="text-xs font-semibold mb-1">
                    Syarat & Ketentuan
                  </p>

                  <p className="text-[11px] leading-relaxed text-[#7A6A75]">
                    {store.terms}
                  </p>
                </div>
              )}

              {/* SIGNATURE */}
              <div className="mt-10 grid grid-cols-2 gap-12 text-xs text-[#7A6A75]">
                <div className="text-center">
                  <div className="h-14" />

                  <p className="border-t border-[#B79BAA] pt-2">
                    Penyewa
                  </p>
                </div>

                <div className="text-center">
                  <div className="h-14" />

                  <p className="border-t border-[#B79BAA] pt-2">
                    {store.name || "Aurora Sewa Kebaya"}
                  </p>
                </div>
              </div>

              {/* FOOTER */}
              <div className="mt-8 pt-4 border-t border-[#FCE4EC] text-center">
                <p className="text-[10px] text-[#A18895]">
                  Terima kasih telah mempercayakan kebutuhan
                  sewa Anda kepada {store.name || "AURORA SEWA KEBAYA"}.
                </p>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function Line({
  label,
  value,
  bold,
  green,
  red,
  large,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`text-[#7A6A75] ${
          large ? "text-base" : "text-sm"
        }`}
      >
        {label}
      </span>

      <span
        className={`text-right ${
          bold ? "font-bold" : ""
        } ${large ? "text-base" : "text-sm"} ${
          green
            ? "text-[#047857]"
            : red
            ? "text-[#B91C1C]"
            : "text-[#1F191E]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-[#7A6A75]">
        {label}
      </span>

      <span className="text-xs font-medium text-right">
        {value}
      </span>
    </div>
  );
}
