import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "@/lib/hooks";
import {
  listCustomers,
  listBookings,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/api";
import { formatDateShort } from "@/lib/format";
import {
  PageHeader,
  SectionCard,
  Loading,
  ErrorState,
  EmptyState,
} from "@/components/common";
import {
  Field,
  TextInput,
  TextArea,
  NativeSelect,
  Btn,
  Modal,
  SearchInput,
  Table,
  Th,
  Td,
} from "@/components/form";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Ruler,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  gender: "P",
  birth_date: "",
  notes: "",
  lingkar_dada: "",
  lingkar_perut: "",
  lingkar_lengan: "",
  lingkar_ketiak: "",
  tinggi_badan: "",
  berat_badan: "",
  panjang_badan: "",
  panjang_lengan: "",
  measurement_notes: "",
};

const numFields = [
  "lingkar_dada",
  "lingkar_perut",
  "lingkar_lengan",
  "lingkar_ketiak",
  "tinggi_badan",
  "berat_badan",
  "panjang_badan",
  "panjang_lengan",
];

export default function Pelanggan() {
  const navigate = useNavigate();

  const {
    data,
    loading,
    error,
    reload,
  } = useAsync(async () => {
    const [customers, bookings] = await Promise.all([
      listCustomers(),
      listBookings(),
    ]);
    return { customers, bookings };
  }, []);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const customers = useMemo(
    () => data?.customers || [],
    [data]
  );

  const bookings = useMemo(
    () => data?.bookings || [],
    [data]
  );

  // Booking terbaru per pelanggan. Status pengambilan dibaca dari Booking,
  // bukan disimpan ulang di tabel pelanggan.
  const latestBookingByCustomer = useMemo(() => {
    const map = new Map();

    [...bookings]
      .sort((a, b) => {
        const da = new Date(
          a.created_at || a.booking_date || a.start_date || 0
        ).getTime();
        const db = new Date(
          b.created_at || b.booking_date || b.start_date || 0
        ).getTime();
        return db - da;
      })
      .forEach((booking) => {
        const customerId =
          booking.customer_id || booking.customer?.id;

        if (customerId && !map.has(customerId)) {
          map.set(customerId, booking);
        }
      });

    return map;
  }, [bookings]);

  const getCustomerBooking = (customer) =>
    latestBookingByCustomer.get(customer.id) || null;

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          !search ||
          (c.name || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (c.phone || "").includes(search) ||
          (c.whatsapp || "").includes(search) ||
          (c.customer_code || "")
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [customers, search]
  );

  const openEdit = (c) => {
    const f = {
      ...empty,
      ...c,
    };

    numFields.forEach(
      (k) => (f[k] = c[k] ?? "")
    );

    f.birth_date = c.birth_date || "";

    setForm(f);
    setModal("edit");
  };

  const save = async () => {
    if (!form.name) {
      toast.error("Nama wajib diisi");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
      };

      numFields.forEach(
        (k) =>
          (payload[k] =
            form[k] === ""
              ? null
              : Number(form[k]))
      );

      payload.birth_date =
        form.birth_date || null;

      if (!payload.customer_code) {
        delete payload.customer_code;
      }

      delete payload.created_at;
      delete payload.updated_at;
      delete payload.id;

      if (modal === "edit") {
        await updateCustomer(
          form.id,
          payload
        );
      } else {
        payload.customer_code =
          "CST-" +
          Date.now()
            .toString()
            .slice(-6);

        await createCustomer(payload);
      }

      toast.success(
        "Pelanggan tersimpan"
      );

      setModal(null);
      reload();
    } catch (e) {
      toast.error(
        e.message ||
          "Gagal menyimpan"
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (
      !window.confirm(
        `Hapus pelanggan "${c.name}"?`
      )
    ) {
      return;
    }

    try {
      await deleteCustomer(c.id);

      toast.success(
        "Pelanggan dihapus"
      );

      reload();
    } catch (e) {
      toast.error(
        e.message ||
          "Gagal menghapus (mungkin masih punya transaksi)"
      );
    }
  };

  /*
   * CETAK DATA JAHIT
   * Format A5 Portrait - 1 lembar
   */
  const printDataJahit = (customer, booking = getCustomerBooking(customer)) => {
    const printWindow = window.open(
      "",
      "_blank",
      "width=800,height=900"
    );

    if (!printWindow) {
      toast.error(
        "Popup diblokir browser. Izinkan popup untuk mencetak."
      );
      return;
    }

    const esc = (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "-";
      }

      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const ukuran = (
      value,
      satuan
    ) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "-";
      }

      return `${esc(value)} ${satuan}`;
    };

    const today =
      new Date().toLocaleDateString(
        "id-ID",
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }
      );

    const customerName =
      customer.name || "-";

    const customerCode =
      customer.customer_code || "-";

    const whatsapp =
      customer.whatsapp ||
      customer.phone ||
      "-";

    const measurementNotes =
      customer.measurement_notes ||
      customer.notes ||
      "-";

    const isShipping =
      booking?.pickup_method === "SHIPPING";

    const pickupLabel = isShipping
      ? "📦 PAKET KIRIMAN"
      : booking?.pickup_method === "STORE_PICKUP"
      ? "🏠 AMBIL DI TOKO"
      : "BELUM ADA BOOKING";

    const shippingRecipient =
      booking?.shipping_recipient ||
      customer.name ||
      "-";

    const shippingPhone =
      booking?.shipping_phone ||
      customer.whatsapp ||
      customer.phone ||
      "-";

    const shippingAddress =
      booking?.shipping_address ||
      customer.address ||
      "-";

    const shippingDate = booking?.shipping_date
      ? new Date(booking.shipping_date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";

    const returnShipDate = booking?.return_ship_date
      ? new Date(booking.return_ship_date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";

    const bookingNumber =
      booking?.booking_number || booking?.booking_no || "-";

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />

          <title>
            Data Jahit - ${esc(customerName)}
          </title>

          <style>
            @page {
              size: A5 portrait;
              margin: 9mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #241d22;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
              font-size: 10px;
              line-height: 1.35;
            }

            body {
              width: 100%;
            }

            .page {
              width: 100%;
              max-width: 130mm;
              margin: 0 auto;
            }

            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 8px;
              border-bottom: 2px solid #e83e8c;
            }

            .brand {
              display: flex;
              align-items: center;
              gap: 7px;
            }

            .logo {
              width: 30px;
              height: 30px;
              border-radius: 7px;
              background: #e83e8c;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 15px;
              font-weight: bold;
            }

            .brand-name {
              margin: 0;
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 0.3px;
            }

            .brand-subtitle {
              margin: 2px 0 0;
              font-size: 8px;
              color: #8a7480;
            }

            .title {
              text-align: right;
            }

            .title h1 {
              margin: 0;
              color: #e83e8c;
              font-size: 15px;
              letter-spacing: 0.7px;
            }

            .title p {
              margin: 2px 0 0;
              color: #8a7480;
              font-size: 7.5px;
            }

            .section {
              margin-top: 8px;
            }

            .section-title {
              margin: 0 0 4px;
              color: #e83e8c;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .customer-box {
              border: 1px solid #f2d6e2;
              border-radius: 5px;
              padding: 6px 8px;
            }

            .customer-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              column-gap: 12px;
              row-gap: 2px;
            }

            .info {
              display: flex;
              gap: 5px;
            }

            .label {
              width: 62px;
              flex-shrink: 0;
              color: #806d77;
            }

            .value {
              font-weight: 600;
              color: #241d22;
            }

            .measurement-box {
              border: 1px solid #f2d6e2;
              border-radius: 5px;
              overflow: hidden;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            th {
              background: #fff4f8;
              color: #806d77;
              font-size: 8px;
              text-align: left;
              padding: 5px 6px;
              border-bottom: 1px solid #f2d6e2;
              text-transform: uppercase;
            }

            td {
              padding: 5px 6px;
              border-bottom: 1px solid #f7e7ed;
            }

            tr:last-child td {
              border-bottom: none;
            }

            .measurement-name {
              font-weight: 600;
            }

            .measurement-value {
              text-align: right;
              font-weight: 700;
              color: #e83e8c;
              white-space: nowrap;
            }

            .notes {
              min-height: 38px;
              border: 1px solid #f2d6e2;
              border-radius: 5px;
              padding: 6px 8px;
              color: #51454c;
              white-space: pre-wrap;
            }

            .hint {
              margin-top: 5px;
              padding: 5px 7px;
              background: #fff4f8;
              border: 1px solid #f2d6e2;
              border-radius: 4px;
              color: #806d77;
              font-size: 7.5px;
            }

            .shipping-notice {
              margin-top: 8px;
              padding: 7px 8px;
              border: 1.5px solid #e83e8c;
              border-radius: 5px;
              background: #fff4f8;
            }

            .shipping-notice-title {
              margin: 0 0 4px;
              color: #e83e8c;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
            }

            .shipping-notice-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 3px 10px;
            }

            .shipping-notice .small {
              font-size: 7.5px;
              color: #806d77;
            }

            .shipping-notice .strong {
              font-weight: 700;
              color: #241d22;
            }

            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 25px;
              margin-top: 24px;
            }

            .signature {
              text-align: center;
              color: #806d77;
              font-size: 8px;
            }

            .space {
              height: 25px;
            }

            .line {
              border-top: 1px solid #bca5b0;
              padding-top: 4px;
            }

            .footer {
              margin-top: 9px;
              padding-top: 5px;
              border-top: 1px solid #f2d6e2;
              text-align: center;
              color: #a28d97;
              font-size: 7px;
            }

            @media print {
              html,
              body {
                width: 148mm;
                min-height: 210mm;
              }

              .page {
                width: 130mm;
                max-width: 130mm;
              }
            }
          </style>
        </head>

        <body>
          <div class="page">

            <div class="header">

              <div class="brand">
                <div class="logo">
                  A
                </div>

                <div>
                  <p class="brand-name">
                    AURORA SEWA KEBAYA
                  </p>

                  <p class="brand-subtitle">
                    Data Ukuran & Jahit
                  </p>
                </div>
              </div>

              <div class="title">
                <h1>
                  DATA JAHIT
                </h1>

                <p>
                  Lembar kerja penjahit
                </p>
              </div>

            </div>

            <div class="section">

              <p class="section-title">
                Data Pelanggan
              </p>

              <div class="customer-box">

                <div class="customer-grid">

                  <div class="info">
                    <span class="label">
                      Nama
                    </span>

                    <span class="value">
                      ${esc(customerName)}
                    </span>
                  </div>

                  <div class="info">
                    <span class="label">
                      Kode
                    </span>

                    <span class="value">
                      ${esc(customerCode)}
                    </span>
                  </div>

                  <div class="info">
                    <span class="label">
                      WhatsApp
                    </span>

                    <span class="value">
                      ${esc(whatsapp)}
                    </span>
                  </div>

                  <div class="info">
                    <span class="label">
                      Gender
                    </span>

                    <span class="value">
                      ${
                        customer.gender === "L"
                          ? "Laki-laki"
                          : customer.gender === "P"
                          ? "Perempuan"
                          : "-"
                      }
                    </span>
                  </div>

                </div>

              </div>

            </div>

            <div class="section">

              <p class="section-title">
                Status Pengambilan
              </p>

              <div class="shipping-notice">
                <p class="shipping-notice-title">
                  ${esc(pickupLabel)}
                </p>

                ${
                  booking
                    ? `
                <div class="shipping-notice-grid">
                  <div>
                    <span class="small">Booking</span><br />
                    <span class="strong">${esc(bookingNumber)}</span>
                  </div>

                  <div>
                    <span class="small">Metode</span><br />
                    <span class="strong">${isShipping ? "Paket Kiriman" : "Ambil di Toko"}</span>
                  </div>

                  ${
                    isShipping
                      ? `
                  <div>
                    <span class="small">Penerima</span><br />
                    <span class="strong">${esc(shippingRecipient)}</span>
                  </div>

                  <div>
                    <span class="small">WhatsApp</span><br />
                    <span class="strong">${esc(shippingPhone)}</span>
                  </div>

                  <div>
                    <span class="small">Tanggal Kirim</span><br />
                    <span class="strong">${esc(shippingDate)}</span>
                  </div>

                  <div>
                    <span class="small">Wajib Kirim Kembali</span><br />
                    <span class="strong">${esc(returnShipDate)}</span>
                  </div>

                  <div style="grid-column: 1 / -1;">
                    <span class="small">Alamat Kirim</span><br />
                    <span class="strong">${esc(shippingAddress)}</span>
                  </div>
                  `
                      : ""
                  }
                </div>
                `
                    : `
                <div class="small">
                  Belum ada booking aktif/tercatat untuk pelanggan ini.
                </div>
                `
                }
              </div>

            </div>

            <div class="section">

              <p class="section-title">
                Ukuran Badan
              </p>

              <div class="measurement-box">

                <table>

                  <thead>
                    <tr>
                      <th>
                        Ukuran
                      </th>

                      <th>
                        Hasil
                      </th>

                      <th>
                        Ukuran
                      </th>

                      <th>
                        Hasil
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    <tr>
                      <td class="measurement-name">
                        Lingkar Dada
                      </td>

                      <td class="measurement-value">
                        ${ukuran(
                          customer.lingkar_dada,
                          "cm"
                        )}
                      </td>

                      <td class="measurement-name">
                        Lingkar Perut
                      </td>

                      <td class="measurement-value">
                        ${ukuran(
                          customer.lingkar_perut,
                          "cm"
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td class="measurement-name">
                        Lingkar Lengan
                      </td>

                      <td class="measurement-value">
                        ${ukuran(
                          customer.lingkar_lengan,
                          "cm"
                        )}
                      </td>

                      <td class="measurement-name">
                        Lingkar Ketiak
                      </td>

                      <td class="measurement-value">
                        ${ukuran(
                          customer.lingkar_ketiak,
                          "cm"
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td class="measurement-name">
                        Tinggi Badan
                      </td>

                      <td class="measurement-value">
                        ${ukuran(
                          customer.tinggi_badan,
                          "cm"
                        )}
                      </td>

                      <td class="measurement-name">
                        Berat Badan
                      </td>

                      <td class="measurement-value">
                        ${ukuran(
                          customer.berat_badan,
                          "kg"
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td class="measurement-name">
                        Panjang Badan
                      </td>

                      <td class="measurement-value">
                        ${ukuran(
                          customer.panjang_badan,
                          "cm"
                        )}
                      </td>

                      <td class="measurement-name">
                        Panjang Lengan
                      </td>

                      <td class="measurement-value">
                        ${ukuran(
                          customer.panjang_lengan,
                          "cm"
                        )}
                      </td>
                    </tr>

                  </tbody>

                </table>

              </div>

            </div>

            <div class="section">

              <p class="section-title">
                Catatan Penjahit
              </p>

              <div class="notes">
                ${esc(measurementNotes)}
              </div>

              <div class="hint">
                Gunakan ukuran di atas sebagai
                acuan penyesuaian/jahit dan
                lakukan pengecekan ulang sebelum
                proses pemotongan kain.
              </div>

            </div>

            <div class="signatures">

              <div class="signature">
                <div class="space"></div>

                <div class="line">
                  Pelanggan
                </div>
              </div>

              <div class="signature">
                <div class="space"></div>

                <div class="line">
                  Penjahit
                </div>
              </div>

            </div>

            <div class="footer">
              Dicetak ${esc(today)}
              &nbsp; • &nbsp;
              AURORA SEWA KEBAYA
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
    <div data-testid="pelanggan-page">

      <PageHeader
        title="Data Pelanggan"
        subtitle={`${customers.length} pelanggan`}
        actions={
          <Btn
            onClick={() => {
              setForm(empty);
              setModal("create");
            }}
            data-testid="customer-add-btn"
          >
            <Plus className="h-4 w-4" />
            Tambah Pelanggan
          </Btn>
        }
      />

      <SectionCard>

        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama / telepon / kode…"
            testid="customer-search"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Belum ada pelanggan"
          />
        ) : (
          <Table>

            <thead>
              <tr>
                <Th>Kode</Th>
                <Th>Nama</Th>
                <Th>Kontak</Th>
                <Th>Alamat</Th>
                <Th>Pengambilan</Th>
                <Th>Terdaftar</Th>
                <Th className="text-right">
                  Aksi
                </Th>
              </tr>
            </thead>

            <tbody>

              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-[#FEFCFD]"
                  data-testid={`customer-row-${c.id}`}
                >

                  <Td className="font-mono text-xs">
                    {c.customer_code}
                  </Td>

                  <Td className="font-medium text-[#1F191E]">
                    {c.name}
                  </Td>

                  <Td>
                    {c.phone ||
                      c.whatsapp ||
                      "-"}
                  </Td>

                  <Td className="max-w-[220px] truncate">
                    {c.address || "-"}
                  </Td>

                  <Td>
                    {(() => {
                      const booking = getCustomerBooking(c);

                      if (!booking) {
                        return (
                          <span className="text-xs text-[#A18895]">
                            Belum ada booking
                          </span>
                        );
                      }

                      if (booking.pickup_method === "SHIPPING") {
                        return (
                          <div className="min-w-[150px]">
                            <span className="inline-flex items-center rounded-full bg-[#FFF0F6] px-2.5 py-1 text-xs font-semibold text-[#E83E8C]">
                              📦 Paket Kiriman
                            </span>
                            <p className="mt-1 text-[11px] text-[#7A6A75]">
                              {booking.booking_number || booking.booking_no || "-"}
                            </p>
                            {booking.shipping_date && (
                              <p className="text-[11px] text-[#7A6A75]">
                                Kirim {formatDateShort(booking.shipping_date)}
                              </p>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="min-w-[150px]">
                          <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#047857]">
                            🏠 Ambil di Toko
                          </span>
                          <p className="mt-1 text-[11px] text-[#7A6A75]">
                            {booking.booking_number || booking.booking_no || "-"}
                          </p>
                        </div>
                      );
                    })()}
                  </Td>

                  <Td>
                    {formatDateShort(
                      c.created_at
                    )}
                  </Td>

                  <Td>

                    <div className="flex justify-end gap-1.5">

                      <Btn
                        variant="ghost"
                        className="px-2 py-1.5"
                        onClick={() =>
                          navigate(
                            `/pelanggan/${c.id}`
                          )
                        }
                        data-testid={`customer-view-${c.id}`}
                        title="Lihat pelanggan"
                      >
                        <Eye className="h-4 w-4" />
                      </Btn>

                      <Btn
                        variant="ghost"
                        className="px-2 py-1.5"
                        onClick={() =>
                          openEdit(c)
                        }
                        data-testid={`customer-edit-${c.id}`}
                        title="Edit pelanggan"
                      >
                        <Pencil className="h-4 w-4" />
                      </Btn>

                      <Btn
                        variant="ghost"
                        className="px-2 py-1.5 text-[#E83E8C]"
                        onClick={() =>
                          printDataJahit(c)
                        }
                        data-testid={`customer-print-jahit-${c.id}`}
                        title="Cetak Data Jahit A5"
                      >
                        <Printer className="h-4 w-4" />
                      </Btn>

                      <Btn
                        variant="ghost"
                        className="px-2 py-1.5 text-[#B91C1C]"
                        onClick={() =>
                          remove(c)
                        }
                        data-testid={`customer-delete-${c.id}`}
                        title="Hapus pelanggan"
                      >
                        <Trash2 className="h-4 w-4" />
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
        open={!!modal}
        onClose={() => setModal(null)}
        title={
          modal === "edit"
            ? "Edit Pelanggan"
            : "Tambah Pelanggan"
        }
        size="lg"
        footer={
          <>
            <Btn
              variant="outline"
              onClick={() =>
                setModal(null)
              }
            >
              Batal
            </Btn>

            <Btn
              onClick={save}
              loading={saving}
              data-testid="customer-save-btn"
            >
              Simpan
            </Btn>
          </>
        }
      >

        <div className="grid sm:grid-cols-2 gap-4">

          <Field
            label="Nama Lengkap"
            required
            className="sm:col-span-2"
          >
            <TextInput
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              data-testid="customer-name-input"
            />
          </Field>

          <Field label="No. WhatsApp">
            <TextInput
              value={form.whatsapp}
              onChange={(e) =>
                setForm({
                  ...form,
                  whatsapp: e.target.value,
                })
              }
              data-testid="customer-whatsapp-input"
            />
          </Field>

          <Field label="No. Telepon">
            <TextInput
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Email">
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
            />
          </Field>

          <Field label="Jenis Kelamin">
            <NativeSelect
              value={form.gender}
              onChange={(e) =>
                setForm({
                  ...form,
                  gender: e.target.value,
                })
              }
              options={[
                {
                  value: "P",
                  label: "Perempuan",
                },
                {
                  value: "L",
                  label: "Laki-laki",
                },
              ]}
            />
          </Field>

          <Field label="Tanggal Lahir">
            <TextInput
              type="date"
              value={form.birth_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  birth_date:
                    e.target.value,
                })
              }
            />
          </Field>

          <Field
            label="Alamat"
            className="sm:col-span-2"
          >
            <TextArea
              value={form.address}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: e.target.value,
                })
              }
            />
          </Field>

        </div>

        <div className="mt-5 pt-5 border-t border-[#FCE4EC]">

          <p className="flex items-center gap-2 text-sm font-semibold text-[#E83E8C] mb-3">
            <Ruler className="h-4 w-4" />
            Ukuran Badan (cm/kg)
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

            <Field label="Lingkar Dada">
              <TextInput
                type="number"
                value={form.lingkar_dada}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lingkar_dada:
                      e.target.value,
                  })
                }
                data-testid="customer-lingkar-dada"
              />
            </Field>

            <Field label="Lingkar Perut">
              <TextInput
                type="number"
                value={form.lingkar_perut}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lingkar_perut:
                      e.target.value,
                  })
                }
              />
            </Field>

            <Field label="Lingkar Lengan">
              <TextInput
                type="number"
                value={form.lingkar_lengan}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lingkar_lengan:
                      e.target.value,
                  })
                }
              />
            </Field>

            <Field label="Lingkar Ketiak">
              <TextInput
                type="number"
                value={form.lingkar_ketiak}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lingkar_ketiak:
                      e.target.value,
                  })
                }
              />
            </Field>

            <Field label="Tinggi Badan">
              <TextInput
                type="number"
                value={form.tinggi_badan}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tinggi_badan:
                      e.target.value,
                  })
                }
              />
            </Field>

            <Field label="Berat Badan">
              <TextInput
                type="number"
                value={form.berat_badan}
                onChange={(e) =>
                  setForm({
                    ...form,
                    berat_badan:
                      e.target.value,
                  })
                }
              />
            </Field>

            <Field label="Panjang Badan">
              <TextInput
                type="number"
                value={form.panjang_badan}
                onChange={(e) =>
                  setForm({
                    ...form,
                    panjang_badan:
                      e.target.value,
                  })
                }
              />
            </Field>

            <Field label="Panjang Lengan">
              <TextInput
                type="number"
                value={form.panjang_lengan}
                onChange={(e) =>
                  setForm({
                    ...form,
                    panjang_lengan:
                      e.target.value,
                  })
                }
              />
            </Field>

          </div>

          <Field
            label="Catatan Ukuran"
            className="mt-3"
          >
            <TextArea
              value={
                form.measurement_notes
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  measurement_notes:
                    e.target.value,
                })
              }
            />
          </Field>

        </div>

      </Modal>

    </div>
  );
}
