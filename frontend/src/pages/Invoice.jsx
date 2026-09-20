import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import { listInvoices, getInvoice, getSetting } from "@/lib/api";
import {
  formatRupiah,
  formatDate,
  formatDateShort,
} from "@/lib/format";
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
import {
  Eye,
  Printer,
  Sparkles,
  CalendarDays,
  User,
  Phone,
} from "lucide-react";
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

  const invoices = useMemo(
    () => data?.invoices || [],
    [data]
  );

  const store = data?.store || {
    name: "AURORA SEWA KEBAYA",
  };

  const filtered = useMemo(
    () =>
      invoices.filter((invoice) => {
        const searchText = search.toLowerCase();

        const okSearch =
          !search ||
          (invoice.invoice_number || "")
            .toLowerCase()
            .includes(searchText) ||
          (invoice.customer?.name || "")
            .toLowerCase()
            .includes(searchText);

        const okStatus =
          !statusFilter ||
          invoice.status === statusFilter;

        return okSearch && okStatus;
      }),
    [invoices, search, statusFilter]
  );

  const view = async (invoice) => {
    try {
      const result = await getInvoice(invoice.id);
      setDetail(result);
    } catch (e) {
      toast.error(e.message);
    }
  };

  /*
   * CETAK INVOICE
   * Dibuat dalam jendela khusus agar tidak terganggu
   * oleh layout/modal aplikasi.
   */
  const printInvoice = () => {
    if (!detail) return;

    const printElement =
      document.getElementById("invoice-print");

    if (!printElement) {
      toast.error("Invoice belum siap untuk dicetak.");
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=1000"
    );

    if (!printWindow) {
      toast.error(
        "Popup diblokir browser. Izinkan popup untuk mencetak invoice."
      );
      return;
    }

    /*
     * Ambil stylesheet yang sedang dipakai aplikasi.
     * Hanya link/style HTML yang disalin,
     * bukan isi CSS-nya ke dalam kode.
     */
    const styles = Array.from(
      document.querySelectorAll(
        'link[rel="stylesheet"], style'
      )
    )
      .map((element) => element.outerHTML)
      .join("\n");

    const invoiceHtml = printElement.innerHTML;

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />

          <title>
            ${detail.invoice_number || "Invoice"} -
            ${store.name || "AURORA SEWA KEBAYA"}
          </title>

          ${styles}

          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              min-height: 100% !important;
              background: white !important;
              color: #1F191E !important;
              font-family: Arial, Helvetica, sans-serif !important;
              font-size: 11px !important;
              line-height: 1.3 !important;
            }

            body {
              overflow: visible !important;
            }

            .invoice-document {
              width: 194mm !important;
              max-width: 194mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: white !important;
            }

            #invoice-print {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /*
             * Membuat jarak lebih rapat agar seluruh invoice
             * masuk ke satu halaman A4.
             */

            #invoice-print .mt-10 {
              margin-top: 16px !important;
            }

            #invoice-print .mt-8 {
              margin-top: 10px !important;
            }

            #invoice-print .mt-6 {
              margin-top: 9px !important;
            }

            #invoice-print .mt-5 {
              margin-top: 8px !important;
            }

            #invoice-print .mt-3 {
              margin-top: 5px !important;
            }

            #invoice-print .mt-2 {
              margin-top: 4px !important;
            }

            #invoice-print .p-4 {
              padding: 7px !important;
            }

            #invoice-print .px-4 {
              padding-left: 7px !important;
              padding-right: 7px !important;
            }

            #invoice-print .py-3 {
              padding-top: 5px !important;
              padding-bottom: 5px !important;
            }

            #invoice-print .py-2 {
              padding-top: 3px !important;
              padding-bottom: 3px !important;
            }

            #invoice-print .py-2\\.5 {
              padding-top: 4px !important;
              padding-bottom: 4px !important;
            }

            #invoice-print .gap-5 {
              gap: 8px !important;
            }

            #invoice-print .gap-4 {
              gap: 7px !important;
            }

            #invoice-print .gap-3 {
              gap: 6px !important;
            }

            #invoice-print .h-12 {
              height: 38px !important;
            }

            #invoice-print .w-12 {
              width: 38px !important;
            }

            #invoice-print .h-14 {
              height: 24px !important;
            }

            #invoice-print .text-2xl {
              font-size: 19px !important;
            }

            #invoice-print .text-base {
              font-size: 12px !important;
            }

            #invoice-print table {
              width: 100% !important;
              border-collapse: collapse !important;
            }

            #invoice-print th,
            #invoice-print td {
              padding-top: 4px !important;
              padding-bottom: 4px !important;
            }

            #invoice-print tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            #invoice-print .rounded-xl,
            #invoice-print .rounded-lg {
              border-radius: 6px !important;
            }

            .no-print {
              display: none !important;
            }

            @media print {
              html,
              body {
                width: 210mm !important;
                min-height: 297mm !important;
                overflow: visible !important;
              }

              .invoice-document {
                width: 194mm !important;
                max-width: 194mm !important;
              }
            }
          </style>
        </head>

        <body>
          <div class="invoice-document">
            <div
              id="invoice-print"
              class="text-sm text-[#1F191E] bg-white"
            >
              ${invoiceHtml}
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      setTimeout(() => {
        printWindow.close();
      }, 500);
    }, 500);
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={reload}
      />
    );
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
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
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
                <Th className="text-right">
                  Aksi
                </Th>
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
                    {formatDateShort(
                      invoice.invoice_date
                    )}
                  </Td>

                  <Td className="font-semibold">
                    {formatRupiah(invoice.total)}
                  </Td>

                  <Td className="text-[#047857]">
                    {formatRupiah(invoice.paid)}
                  </Td>

                  <Td className="text-[#B91C1C]">
                    {formatRupiah(
                      invoice.remaining
                    )}
                  </Td>

                  <Td>
                    <StatusBadge
                      status={invoice.status}
                    />
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
              onClick={printInvoice}
              data-testid="invoice-print-btn"
            >
              <Printer className="h-4 w-4" />
              Cetak / PDF
            </Btn>
          </>
        }
      >
        {detail && (
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
                    {store.name ||
                      "AURORA SEWA KEBAYA"}
                  </p>

                  {store.address && (
                    <p className="text-xs text-[#7A6A75] mt-1">
                      {store.address}
                    </p>
                  )}

                  {store.phone && (
                    <p className="text-xs text-[#7A6A75]">
                      Telp / WhatsApp:{" "}
                      {store.phone}
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
                  <StatusBadge
                    status={detail.status}
                  />
                </div>
              </div>
            </div>

            {/* CUSTOMER + INVOICE INFO */}
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
                  value={formatDate(
                    detail.invoice_date
                  )}
                />

                {detail.due_date && (
                  <InfoRow
                    label="Jatuh Tempo"
                    value={formatDate(
                      detail.due_date
                    )}
                  />
                )}

                <InfoRow
                  label="Status"
                  value={
                    <StatusBadge
                      status={detail.status}
                    />
                  }
                />
              </div>
            </div>

            {/* JADWAL SEWA & PENGEMBALIAN */}
            {(detail.booking?.start_date ||
              detail.booking?.end_date ||
              detail.booking?.rental_date ||
              detail.booking?.return_date ||
              detail.booking?.pickup_method) && (
              <div className="mt-5 rounded-xl bg-[#FFF7FA] border border-[#FCE4EC] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-[#E83E8C]" />
                  <p className="font-semibold">
                    Jadwal Sewa & Pengembalian
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
                      Wajib Pengembalian
                    </p>
                    <p className="font-semibold mt-1 text-[#B91C1C]">
                      {formatDate(
                        detail.booking?.end_date ||
                          detail.booking?.return_date
                      )}
                    </p>
                  </div>
                </div>

                {detail.booking?.pickup_method === "SHIPPING" && (
                  <div className="mt-4 rounded-lg border border-[#FCE4EC] bg-white p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">📦</span>
                      <p className="font-semibold text-[#E83E8C]">
                        Paket Kiriman
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-[10px] uppercase text-[#A18895]">
                          Penerima
                        </p>
                        <p className="text-xs font-medium mt-0.5">
                          {detail.booking?.shipping_recipient || "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase text-[#A18895]">
                          WhatsApp
                        </p>
                        <p className="text-xs font-medium mt-0.5">
                          {detail.booking?.shipping_phone || "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase text-[#A18895]">
                          Tanggal Kirim
                        </p>
                        <p className="text-xs font-medium mt-0.5">
                          {detail.booking?.shipping_date
                            ? formatDate(detail.booking.shipping_date)
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase text-[#A18895]">
                          Wajib Kirim Kembali
                        </p>
                        <p className="text-xs font-semibold text-[#B91C1C] mt-0.5">
                          {detail.booking?.return_ship_date
                            ? formatDate(detail.booking.return_ship_date)
                            : "-"}
                        </p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-[10px] uppercase text-[#A18895]">
                          Perkiraan Sampai Toko
                        </p>
                        <p className="text-xs font-semibold text-[#047857] mt-0.5">
                          {detail.booking?.return_arrival_date
                            ? formatDate(detail.booking.return_arrival_date)
                            : "-"}
                        </p>
                      </div>

                      {detail.booking?.shipping_address && (
                        <div className="col-span-2">
                          <p className="text-[10px] uppercase text-[#A18895]">
                            Alamat Pengiriman
                          </p>
                          <p className="text-xs mt-0.5">
                            {detail.booking.shipping_address}
                          </p>
                        </div>
                      )}

                      {detail.booking?.shipping_notes && (
                        <div className="col-span-2">
                          <p className="text-[10px] uppercase text-[#A18895]">
                            Catatan Kiriman
                          </p>
                          <p className="text-xs mt-0.5">
                            {detail.booking.shipping_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DETAIL BARANG */}
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
                            {formatRupiah(
                              item.rental_price
                            )}
                          </td>

                          <td className="px-4 py-3 text-right font-medium">
                            {formatRupiah(
                              item.subtotal
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    {(detail.booking?.items || [])
                      .length === 0 && (
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

            {/* RINGKASAN PEMBAYARAN */}
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
                      value={formatRupiah(
                        detail.subtotal
                      )}
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
                        value={formatRupiah(
                          detail.deposit
                        )}
                      />
                    )}

                    <div className="border-t border-[#FCE4EC] pt-3 mt-3">
                      <Line
                        label="TOTAL"
                        value={formatRupiah(
                          detail.total
                        )}
                        bold
                        large
                      />
                    </div>

                    <div className="pt-2">
                      <Line
                        label="Total Dibayar"
                        value={formatRupiah(
                          detail.paid
                        )}
                        green
                        bold
                      />

                      <div className="mt-2 rounded-lg bg-[#FFF5F5] px-3 py-2.5">
                        <Line
                          label="Sisa Pembayaran"
                          value={formatRupiah(
                            detail.remaining
                          )}
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

            {/* STATUS PEMBAYARAN */}
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

            {/* SYARAT & KETENTUAN */}
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

            {/* TANDA TANGAN */}
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
                  {store.name ||
                    "Aurora Sewa Kebaya"}
                </p>
              </div>
            </div>

            {/* FOOTER */}
            <div className="mt-8 pt-4 border-t border-[#FCE4EC] text-center">
              <p className="text-[10px] text-[#A18895]">
                Terima kasih telah mempercayakan
                kebutuhan sewa Anda kepada{" "}
                {store.name ||
                  "AURORA SEWA KEBAYA"}.
              </p>
            </div>
          </div>
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
