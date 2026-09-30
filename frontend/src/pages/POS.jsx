import { useState, useMemo, useEffect, useCallback } from "react";
import { useAsync } from "@/lib/hooks";
import {
  listCustomers,
  listProducts,
  listBookings,
  getBooking,
  getInvoiceByBooking,
  checkoutRental,
  addPayment,
} from "@/lib/api";
import { formatRupiah, todayISO } from "@/lib/format";
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
  NativeSelect,
  Btn,
  SearchInput,
} from "@/components/form";
import { PAYMENT_METHODS } from "@/lib/constants";
import {
  ClipboardList,
  RefreshCw,
  CreditCard,
  PackageCheck,
  Receipt,
  User,
  Phone,
  CalendarDays,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export default function POS() {
  const {
    data,
    loading,
    error,
    reload,
  } = useAsync(async () => {
    const [customers, products, bookings] =
      await Promise.all([
        listCustomers(),
        listProducts(),
        listBookings(),
      ]);

    return {
      customers,
      products,
      bookings,
    };
  }, []);

  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");

  const [loadingBooking, setLoadingBooking] = useState(false);
  const [bookingProcessing, setBookingProcessing] = useState(false);

  const [bookingPayAmount, setBookingPayAmount] = useState("");
  const [bookingPayMethod, setBookingPayMethod] = useState("CASH");
  const [bookingPayType, setBookingPayType] = useState("DP");

  const [result, setResult] = useState(null);

  const customers = data?.customers || [];
  const products = useMemo(
    () => data?.products || [],
    [data]
  );

  const bookings = useMemo(
    () => data?.bookings || [],
    [data]
  );

  /*
   * POS sekarang hanya untuk melanjutkan Booking.
   * Booking CANCELLED / RETURNED / COMPLETED / RENTED
   * tidak ditawarkan sebagai booking baru untuk diproses.
   */
  const activeBookings = useMemo(() => {
    return bookings.filter((booking) =>
      [
        "PENDING",
        "CONFIRMED",
        "READY",
        "PAID",
      ].includes(booking.status)
    );
  }, [bookings]);

  const getCustomerName = useCallback(
    (customerId) => {
      const customer = customers.find(
        (item) => item.id === customerId
      );

      return customer?.name || "-";
    },
    [customers]
  );

  const getCustomerPhone = useCallback(
    (booking) => {
      return (
        booking?.customer?.whatsapp ||
        booking?.customer?.phone ||
        customers.find(
          (item) => item.id === booking?.customer_id
        )?.whatsapp ||
        customers.find(
          (item) => item.id === booking?.customer_id
        )?.phone ||
        "-"
      );
    },
    [customers]
  );

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();

    return activeBookings.filter((booking) => {
      const customerName =
        booking.customer?.name ||
        getCustomerName(booking.customer_id);

      const phone = getCustomerPhone(booking);

      const matchesSearch =
        !q ||
        String(
          booking.booking_number || ""
        )
          .toLowerCase()
          .includes(q) ||
        String(customerName || "")
          .toLowerCase()
          .includes(q) ||
        String(phone || "")
          .toLowerCase()
          .includes(q);

      const matchesStatus =
        !bookingStatusFilter ||
        booking.status === bookingStatusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    activeBookings,
    bookingSearch,
    bookingStatusFilter,
    getCustomerName,
    getCustomerPhone,
  ]);

  const bookingItems =
    selectedBooking?.items || [];

  const getProductImage = (productId) =>
    products.find(
      (product) => product.id === productId
    )?.photo_url || "";

  const loadBooking = useCallback(
    async (bookingId) => {
      setSelectedBookingId(bookingId);
      setSelectedBooking(null);
      setSelectedInvoice(null);
      setBookingPayAmount("");
      setBookingPayType("DP");

      if (!bookingId) {
        return;
      }

      setLoadingBooking(true);

      try {
        const [booking, invoice] =
          await Promise.all([
            getBooking(bookingId),
            getInvoiceByBooking(bookingId),
          ]);

        setSelectedBooking(booking);
        setSelectedInvoice(invoice);

        if (invoice) {
          const remaining = Math.max(
            0,
            Number(invoice.remaining || 0)
          );

          setBookingPayAmount(
            remaining > 0
              ? String(remaining)
              : ""
          );

          setBookingPayType(
            remaining > 0 ? "FULL" : "FULL"
          );
        }

        toast.success(
          "Booking berhasil dimuat"
        );
      } catch (e) {
        toast.error(
          e?.message ||
            "Gagal memuat booking"
        );
      } finally {
        setLoadingBooking(false);
      }
    },
    []
  );

  /*
   * Dari halaman Booking, booking baru dapat otomatis
   * dibuka di POS melalui sessionStorage.
   */
  useEffect(() => {
    const incomingBookingId =
      sessionStorage.getItem(
        "aurora_open_booking_id"
      );

    if (!incomingBookingId) {
      return;
    }

    sessionStorage.removeItem(
      "aurora_open_booking_id"
    );

    loadBooking(incomingBookingId);
  }, [loadBooking]);

  const selectBookingFromList = async (
    bookingId
  ) => {
    await loadBooking(bookingId);
  };

  const payExistingBooking = async () => {
    if (!selectedBooking) {
      toast.error(
        "Pilih booking terlebih dahulu"
      );
      return;
    }

    if (!selectedInvoice) {
      toast.error(
        "Invoice booking tidak ditemukan"
      );
      return;
    }

    if (
      selectedBooking.status ===
      "CANCELLED"
    ) {
      toast.error(
        "Booking sudah dibatalkan"
      );
      return;
    }

    if (
      selectedInvoice.status ===
      "CANCELLED"
    ) {
      toast.error(
        "Invoice sudah dibatalkan"
      );
      return;
    }

    const amount = Number(
      bookingPayAmount || 0
    );

    if (amount <= 0) {
      toast.error(
        "Masukkan jumlah pembayaran"
      );
      return;
    }

    const remaining = Number(
      selectedInvoice.remaining || 0
    );

    if (amount > remaining) {
      toast.error(
        `Pembayaran tidak boleh melebihi sisa tagihan ${formatRupiah(
          remaining
        )}`
      );
      return;
    }

    const isFull =
      amount >= remaining;

    setBookingProcessing(true);

    try {
      const payment = await addPayment({
        invoice_id:
          selectedInvoice.id,
        booking_id:
          selectedBooking.id,
        customer_id:
          selectedBooking.customer_id,
        amount,
        payment_method:
          bookingPayMethod,
        payment_type:
          isFull
            ? "FULL"
            : "DP",
      });

      toast.success(
        isFull
          ? "Pelunasan berhasil"
          : "DP berhasil diterima"
      );

      setResult({
        type: "booking-payment",
        booking_number:
          selectedBooking.booking_number,
        invoice_number:
          selectedInvoice.invoice_number,
        total:
          selectedInvoice.total,
        paid:
          payment?.paid ??
          Number(
            selectedInvoice.paid || 0
          ) + amount,
        remaining:
          payment?.remaining ??
          Math.max(
            0,
            remaining - amount
          ),
        payment_type:
          isFull ? "FULL" : "DP",
      });

      await reload();

      const [
        refreshedBooking,
        refreshedInvoice,
      ] = await Promise.all([
        getBooking(
          selectedBooking.id
        ),
        getInvoiceByBooking(
          selectedBooking.id
        ),
      ]);

      setSelectedBooking(
        refreshedBooking
      );

      setSelectedInvoice(
        refreshedInvoice
      );

      if (refreshedInvoice) {
        setBookingPayAmount(
          Number(
            refreshedInvoice.remaining || 0
          ) > 0
            ? String(
                refreshedInvoice.remaining
              )
            : ""
        );
      }
    } catch (e) {
      toast.error(
        e?.message ||
          "Pembayaran gagal"
      );
    } finally {
      setBookingProcessing(false);
    }
  };

  const checkoutExistingBooking =
    async () => {
      if (!selectedBooking) {
        toast.error(
          "Pilih booking terlebih dahulu"
        );
        return;
      }

      if (
        selectedBooking.status ===
        "CANCELLED"
      ) {
        toast.error(
          "Booking sudah dibatalkan"
        );
        return;
      }

      if (
        selectedBooking.status ===
        "RENTED"
      ) {
        toast.info(
          "Booking ini sudah menjadi rental"
        );
        return;
      }

      if (!selectedInvoice) {
        toast.error(
          "Invoice booking tidak ditemukan"
        );
        return;
      }

      setBookingProcessing(true);

      try {
        const rental =
          await checkoutRental(
            selectedBooking.id,
            todayISO()
          );

        toast.success(
          "Booking berhasil diproses menjadi rental"
        );

        setResult({
          type: "booking-checkout",
          booking_number:
            selectedBooking.booking_number,
          rental_number:
            rental?.rental_number || "-",
          invoice_number:
            selectedInvoice?.invoice_number ||
            "-",
          total:
            selectedInvoice?.total ||
            selectedBooking.total ||
            0,
          paid:
            selectedInvoice?.paid ||
            0,
          remaining:
            selectedInvoice?.remaining ||
            0,
        });

        await reload();

        const [
          refreshedBooking,
          refreshedInvoice,
        ] = await Promise.all([
          getBooking(
            selectedBooking.id
          ),
          getInvoiceByBooking(
            selectedBooking.id
          ),
        ]);

        setSelectedBooking(
          refreshedBooking
        );

        setSelectedInvoice(
          refreshedInvoice
        );
      } catch (e) {
        toast.error(
          e?.message ||
            "Gagal memproses rental"
        );
      } finally {
        setBookingProcessing(false);
      }
    };

  const clearSelection = () => {
    setSelectedBookingId("");
    setSelectedBooking(null);
    setSelectedInvoice(null);
    setBookingPayAmount("");
    setBookingPayType("DP");
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
    <div data-testid="pos-page">
      <PageHeader
        title="POS / Kasir"
        subtitle="Lanjutkan Booking → Pembayaran → Rental"
        actions={
          <Btn
            variant="secondary"
            onClick={reload}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Btn>
        }
      />

      {/* ============================================================
          BOOKING SELECTOR
      ============================================================ */}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5">
          <SectionCard>
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#FFF0F6] text-[#E83E8C] grid place-items-center">
                <ClipboardList className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h3 className="font-bold text-[#1F191E]">
                  Pilih Booking
                </h3>
                <p className="text-xs text-[#7A6A75] mt-0.5">
                  Pilih booking yang akan
                  dilanjutkan ke pembayaran
                  atau rental.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <SearchInput
                value={bookingSearch}
                onChange={setBookingSearch}
                placeholder="Cari nomor booking / pelanggan / WhatsApp..."
                testid="pos-booking-search"
              />

              <NativeSelect
                value={
                  bookingStatusFilter
                }
                onChange={(e) =>
                  setBookingStatusFilter(
                    e.target.value
                  )
                }
                placeholder="Semua status aktif"
                options={[
                  "PENDING",
                  "CONFIRMED",
                  "READY",
                  "PAID",
                ]}
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-[#7A6A75]">
                {filteredBookings.length}{" "}
                booking tersedia
              </p>

              {bookingSearch ||
              bookingStatusFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setBookingSearch("");
                    setBookingStatusFilter(
                      ""
                    );
                  }}
                  className="text-xs text-[#E83E8C] hover:underline"
                >
                  Reset filter
                </button>
              ) : null}
            </div>

            {filteredBookings.length ===
            0 ? (
              <div className="mt-4">
                <EmptyState
                  title="Tidak ada booking"
                  subtitle="Booking yang dapat dilanjutkan akan muncul di sini."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {filteredBookings.map(
                  (booking) => {
                    const active =
                      selectedBookingId ===
                      booking.id;

                    const customerName =
                      booking.customer
                        ?.name ||
                      getCustomerName(
                        booking.customer_id
                      );

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() =>
                          selectBookingFromList(
                            booking.id
                          )
                        }
                        className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                          active
                            ? "border-[#E83E8C] bg-[#FFF5F8] shadow-sm"
                            : "border-[#F8D7E3] bg-white hover:bg-[#FFF9FB] hover:border-[#F3BDD3]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-[#1F191E]">
                              {
                                booking.booking_number
                              }
                            </p>

                            <p className="text-sm font-medium text-[#1F191E] mt-1 truncate">
                              {customerName}
                            </p>

                            <p className="text-[11px] text-[#7A6A75] mt-1">
                              {booking.start_date}{" "}
                              —{" "}
                              {booking.end_date}
                            </p>
                          </div>

                          <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-[#FFF0F6] text-[#C52F73]">
                            {booking.status}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[11px] text-[#7A6A75]">
                            {getCustomerPhone(
                              booking
                            )}
                          </span>

                          <span className="font-bold text-sm text-[#E83E8C]">
                            {formatRupiah(
                              booking.total ||
                                0
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ============================================================
            BOOKING DETAIL
        ============================================================ */}

        <div className="xl:col-span-7">
          {!selectedBooking ? (
            <div className="bg-white border border-[#F8D7E3] rounded-2xl min-h-[620px] grid place-items-center">
              <div className="text-center p-8 max-w-md">
                <div className="h-16 w-16 rounded-2xl bg-[#FFF0F6] text-[#E83E8C] grid place-items-center mx-auto">
                  <ClipboardList className="h-8 w-8" />
                </div>

                <h3 className="mt-5 text-lg font-bold text-[#1F191E]">
                  Pilih Booking untuk
                  dilanjutkan
                </h3>

                <p className="mt-2 text-sm text-[#7A6A75] leading-relaxed">
                  Semua transaksi di POS
                  dimulai dari Booking.
                  Pilih booking di sebelah
                  kiri untuk melihat detail,
                  menerima pembayaran, dan
                  memproses rental.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* HEADER */}
              <SectionCard>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={
                          clearSelection
                        }
                        className="h-8 w-8 rounded-lg border border-[#F8D7E3] grid place-items-center text-[#7A6A75] hover:bg-[#FFF5F8]"
                        title="Kembali ke daftar booking"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>

                      <h3 className="font-bold text-xl text-[#1F191E]">
                        {
                          selectedBooking.booking_number
                        }
                      </h3>

                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#FFF0F6] text-[#C52F73]">
                        {
                          selectedBooking.status
                        }
                      </span>
                    </div>

                    <div className="mt-4 grid sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-[#E83E8C] mt-0.5" />

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                            Pelanggan
                          </p>
                          <p className="font-semibold text-[#1F191E]">
                            {selectedBooking
                              .customer
                              ?.name ||
                              getCustomerName(
                                selectedBooking.customer_id
                              )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-[#E83E8C] mt-0.5" />

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                            WhatsApp
                          </p>
                          <p className="font-semibold text-[#1F191E]">
                            {getCustomerPhone(
                              selectedBooking
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <CalendarDays className="h-4 w-4 text-[#E83E8C] mt-0.5" />

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                            Periode Sewa
                          </p>
                          <p className="font-semibold text-[#1F191E]">
                            {
                              selectedBooking.start_date
                            }{" "}
                            —{" "}
                            {
                              selectedBooking.end_date
                            }
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                          Tanggal Booking
                        </p>
                        <p className="font-semibold text-[#1F191E]">
                          {selectedBooking.booking_date ||
                            "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#FFF7FA] border border-[#FCE4EC] px-4 py-3 min-w-[180px]">
                    <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                      Total Booking
                    </p>
                    <p className="text-2xl font-bold text-[#E83E8C] mt-1">
                      {formatRupiah(
                        selectedBooking.total ||
                          0
                      )}
                    </p>
                  </div>
                </div>
              </SectionCard>

              {/* ITEMS */}
              <SectionCard>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PackageCheck className="h-5 w-5 text-[#E83E8C]" />
                    <h3 className="font-semibold text-[#1F191E]">
                      Detail Barang
                    </h3>
                  </div>

                  <span className="text-xs text-[#7A6A75]">
                    {bookingItems.length} item
                  </span>
                </div>

                {loadingBooking ? (
                  <div className="py-8 text-center text-sm text-[#7A6A75]">
                    Memuat detail booking...
                  </div>
                ) : bookingItems.length ===
                  0 ? (
                  <EmptyState
                    title="Tidak ada barang"
                    subtitle="Booking ini tidak memiliki item."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {bookingItems.map(
                      (item, index) => {
                        const imageUrl =
                          item.product
                            ?.photo_url ||
                          getProductImage(
                            item.product_id
                          );

                        const qty =
                          Number(
                            item.quantity || 0
                          );

                        const price =
                          Number(
                            item.rental_price ||
                              0
                          );

                        return (
                          <div
                            key={
                              item.id ||
                              `${item.product_id}-${index}`
                            }
                            className="flex items-center justify-between gap-3 rounded-xl border border-[#FCE4EC] bg-[#FEFCFD] p-3.5"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-20 w-20 rounded-xl overflow-hidden bg-[#FFF5F8] border border-[#FCE4EC] shrink-0 grid place-items-center">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={
                                      item
                                        .product
                                        ?.name ||
                                      "Produk"
                                    }
                                    className="h-full w-full object-cover"
                                    onError={(
                                      e
                                    ) => {
                                      e.currentTarget.style.display =
                                        "none";
                                    }}
                                  />
                                ) : (
                                  <PackageCheck className="h-7 w-7 text-[#E8B4C9]" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="font-bold text-[#1F191E] truncate">
                                  {item.product
                                    ?.name ||
                                    "Produk"}
                                </p>

                                {item.product
                                  ?.product_code && (
                                  <p className="text-[11px] text-[#7A6A75] mt-0.5">
                                    Kode:{" "}
                                    {
                                      item
                                        .product
                                        .product_code
                                    }
                                  </p>
                                )}

                                <p className="text-xs text-[#A18895] mt-1">
                                  {formatRupiah(
                                    price
                                  )}{" "}
                                  × {qty}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                                Subtotal
                              </p>
                              <p className="font-bold text-[#E83E8C] mt-1">
                                {formatRupiah(
                                  item.subtotal ||
                                    price * qty
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </SectionCard>

              {/* PAYMENT */}
              <SectionCard>
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-[#E83E8C]" />

                  <div>
                    <h3 className="font-semibold text-[#1F191E]">
                      Pembayaran
                    </h3>
                    <p className="text-xs text-[#7A6A75]">
                      Terima DP atau pelunasan
                      dari booking ini.
                    </p>
                  </div>
                </div>

                {loadingBooking ? (
                  <div className="py-8 text-center text-sm text-[#7A6A75]">
                    Memuat invoice...
                  </div>
                ) : !selectedInvoice ? (
                  <div className="p-4 rounded-lg bg-[#FFF5F8] border border-[#F8D7E3] text-sm text-[#7A6A75]">
                    Invoice untuk booking ini
                    tidak ditemukan.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-[#FEFCFD] border border-[#FCE4EC]">
                        <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                          Invoice
                        </p>
                        <p className="text-sm font-semibold mt-1">
                          {
                            selectedInvoice.invoice_number
                          }
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#FEFCFD] border border-[#FCE4EC]">
                        <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                          Total
                        </p>
                        <p className="text-sm font-semibold mt-1">
                          {formatRupiah(
                            selectedInvoice.total
                          )}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#ECFDF5] border border-[#D1FAE5]">
                        <p className="text-[10px] uppercase tracking-wide text-[#047857]">
                          Sudah Dibayar
                        </p>
                        <p className="text-sm font-bold text-[#047857] mt-1">
                          {formatRupiah(
                            selectedInvoice.paid ||
                              0
                          )}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-[#FFF7FA] border border-[#FCE4EC]">
                        <p className="text-[10px] uppercase tracking-wide text-[#A18895]">
                          Sisa
                        </p>
                        <p className="text-sm font-bold text-[#B91C1C] mt-1">
                          {formatRupiah(
                            selectedInvoice.remaining ||
                              0
                          )}
                        </p>
                      </div>
                    </div>

                    {selectedInvoice.status ===
                    "CANCELLED" ? (
                      <div className="rounded-xl border border-[#F3D9E4] bg-[#FFF7FA] p-4">
                        <p className="font-semibold text-[#B91C1C]">
                          Booking dibatalkan
                        </p>
                        <p className="text-xs text-[#7A6A75] mt-1">
                          Invoice ini sudah
                          dibatalkan. DP yang
                          sudah dibayarkan
                          mengikuti kebijakan
                          DP hangus.
                        </p>
                      </div>
                    ) : Number(
                        selectedInvoice.remaining ||
                          0
                      ) > 0 ? (
                      <div className="rounded-xl border border-[#FCE4EC] bg-[#FEFCFD] p-4">
                        <div className="flex items-start gap-2 mb-4">
                          <div className="h-8 w-8 rounded-lg bg-[#FFF0F6] text-[#E83E8C] grid place-items-center shrink-0">
                            <CreditCard className="h-4 w-4" />
                          </div>

                          <div>
                            <p className="font-semibold text-sm text-[#1F191E]">
                              Terima Pembayaran
                            </p>
                            <p className="text-xs text-[#7A6A75] mt-0.5">
                              Pilih DP jika
                              customer membayar
                              sebagian, atau Full
                              jika melunasi.
                            </p>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-3">
                          <Field label="Jenis Pembayaran">
                            <NativeSelect
                              value={
                                bookingPayType
                              }
                              onChange={(e) =>
                                setBookingPayType(
                                  e.target
                                    .value
                                )
                              }
                              options={[
                                {
                                  value: "DP",
                                  label:
                                    "DP / Sebagian",
                                },
                                {
                                  value: "FULL",
                                  label:
                                    "Pelunasan / Full",
                                },
                              ]}
                            />
                          </Field>

                          <Field label="Jumlah Bayar">
                            <TextInput
                              type="number"
                              min="1"
                              value={
                                bookingPayAmount
                              }
                              onChange={(e) =>
                                setBookingPayAmount(
                                  e.target
                                    .value
                                )
                              }
                              placeholder="Masukkan jumlah"
                            />
                          </Field>

                          <Field label="Metode Pembayaran">
                            <NativeSelect
                              value={
                                bookingPayMethod
                              }
                              onChange={(e) =>
                                setBookingPayMethod(
                                  e.target
                                    .value
                                )
                              }
                              options={
                                PAYMENT_METHODS
                              }
                            />
                          </Field>
                        </div>

                        <div className="mt-3 rounded-lg bg-[#FFF7FA] border border-[#FCE4EC] p-3">
                          <p className="text-xs text-[#7A6A75]">
                            <b className="text-[#1F191E]">
                              Info:
                            </b>{" "}
                            DP adalah pembayaran
                            sebagian. Pelunasan
                            digunakan ketika
                            customer membayar
                            seluruh sisa invoice.
                          </p>
                        </div>

                        <Btn
                          onClick={
                            payExistingBooking
                          }
                          loading={
                            bookingProcessing
                          }
                          className="w-full mt-3 py-2.5"
                        >
                          <CreditCard className="h-4 w-4" />
                          {bookingPayType ===
                          "FULL"
                            ? "Terima Pelunasan"
                            : "Terima DP"}
                        </Btn>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[#D1FAE5] bg-[#ECFDF5] p-4 flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-[#047857]" />
                        <div>
                          <p className="font-semibold text-[#047857]">
                            Pembayaran Lunas
                          </p>
                          <p className="text-xs text-[#047857]">
                            Tidak ada sisa pembayaran.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>

              {/* RENTAL ACTION */}
              <SectionCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#1F191E]">
                      Proses Rental
                    </p>
                    <p className="text-xs text-[#7A6A75] mt-1">
                      Setelah barang diserahkan
                      kepada customer, proses
                      booking menjadi rental.
                    </p>
                  </div>

                  <Btn
                    variant="secondary"
                    onClick={
                      checkoutExistingBooking
                    }
                    loading={
                      bookingProcessing
                    }
                    disabled={
                      selectedBooking.status ===
                        "CANCELLED" ||
                      selectedBooking.status ===
                        "RENTED"
                    }
                    className="sm:min-w-[220px]"
                  >
                    <PackageCheck className="h-4 w-4" />
                    Proses Rental
                  </Btn>
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          RESULT
      ============================================================ */}

      {result && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
          onClick={() =>
            setResult(null)
          }
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl"
            onClick={(e) =>
              e.stopPropagation()
            }
            data-testid="pos-result"
          >
            <div className="h-14 w-14 rounded-full bg-[#ECFDF5] text-[#047857] grid place-items-center mx-auto">
              {result.type ===
              "booking-payment" ? (
                <CreditCard className="h-7 w-7" />
              ) : (
                <Receipt className="h-7 w-7" />
              )}
            </div>

            <h3 className="mt-4 text-lg font-bold text-[#1F191E]">
              {result.type ===
              "booking-payment"
                ? result.payment_type ===
                  "FULL"
                  ? "Pelunasan Berhasil"
                  : "DP Berhasil"
                : "Rental Berhasil"}
            </h3>

            <div className="mt-4 text-sm text-left space-y-2 bg-[#FEFCFD] rounded-xl p-4 border border-[#FCE4EC]">
              {result.booking_number && (
                <p className="flex justify-between gap-4">
                  <span className="text-[#7A6A75]">
                    Booking
                  </span>
                  <b className="text-right">
                    {
                      result.booking_number
                    }
                  </b>
                </p>
              )}

              {result.rental_number && (
                <p className="flex justify-between gap-4">
                  <span className="text-[#7A6A75]">
                    Rental
                  </span>
                  <b className="text-right">
                    {result.rental_number}
                  </b>
                </p>
              )}

              {result.invoice_number && (
                <p className="flex justify-between gap-4">
                  <span className="text-[#7A6A75]">
                    Invoice
                  </span>
                  <b className="text-right">
                    {
                      result.invoice_number
                    }
                  </b>
                </p>
              )}

              <p className="flex justify-between gap-4">
                <span className="text-[#7A6A75]">
                  Total
                </span>
                <b className="text-[#E83E8C]">
                  {formatRupiah(
                    result.total || 0
                  )}
                </b>
              </p>

              <p className="flex justify-between gap-4">
                <span className="text-[#7A6A75]">
                  Dibayar
                </span>
                <b className="text-[#047857]">
                  {formatRupiah(
                    result.paid || 0
                  )}
                </b>
              </p>

              <p className="flex justify-between gap-4">
                <span className="text-[#7A6A75]">
                  Sisa
                </span>
                <b className="text-[#B91C1C]">
                  {formatRupiah(
                    result.remaining || 0
                  )}
                </b>
              </p>
            </div>

            <Btn
              onClick={() =>
                setResult(null)
              }
              className="mt-5 w-full"
            >
              Selesai
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
