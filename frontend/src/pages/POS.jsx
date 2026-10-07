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
  Search,
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

  const customers = useMemo(
    () => data?.customers || [],
    [data]
  );
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

  const selectedCustomerName =
    selectedBooking?.customer?.name ||
    getCustomerName(selectedBooking?.customer_id);

  const selectedCustomerPhone = getCustomerPhone(selectedBooking);

  const selectedTotal = Number(
    selectedInvoice?.total ?? selectedBooking?.total ?? 0
  );
  const selectedPaid = Number(selectedInvoice?.paid || 0);
  const selectedRemaining = Number(selectedInvoice?.remaining || 0);

  return (
    <div data-testid="pos-page" className="space-y-4">
      {/* HEADER COMPACT */}
      <PageHeader
        title="POS / Kasir"
        subtitle="Lanjutkan Booking → Pembayaran → Rental"
        actions={
          <Btn
            variant="secondary"
            onClick={reload}
            className="text-xs px-3 py-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Btn>
        }
      />

      {/* POS WORKSPACE */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* BOOKING LIST */}
        <div className="xl:col-span-4">
          <SectionCard className="!p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-[#FFF0F6] text-[#E83E8C] grid place-items-center shrink-0">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#1F191E]">
                    Booking
                  </h3>
                  <p className="text-[10px] text-[#8D7A84]">
                    Pilih transaksi yang akan diproses
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#C52F73] bg-[#FFF0F6] px-2 py-1 rounded-full">
                {filteredBookings.length}
              </span>
            </div>

            <div className="space-y-2">
              <SearchInput
                value={bookingSearch}
                onChange={setBookingSearch}
                placeholder="Cari booking / pelanggan / WhatsApp..."
                testid="pos-booking-search"
              />
              <NativeSelect
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value)}
                placeholder="Semua status aktif"
                options={["PENDING", "CONFIRMED", "READY", "PAID"]}
              />
            </div>

            {(bookingSearch || bookingStatusFilter) && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBookingSearch("");
                    setBookingStatusFilter("");
                  }}
                  className="text-[10px] text-[#E83E8C] hover:underline"
                >
                  Reset filter
                </button>
              </div>
            )}

            {filteredBookings.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="Tidak ada booking"
                  subtitle="Booking aktif akan muncul di sini."
                />
              </div>
            ) : (
              <div className="mt-3 space-y-1.5 max-h-[680px] overflow-y-auto pr-1">
                {filteredBookings.map((booking) => {
                  const active = selectedBookingId === booking.id;
                  const customerName =
                    booking.customer?.name ||
                    getCustomerName(booking.customer_id);

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => selectBookingFromList(booking.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                        active
                          ? "border-[#E83E8C] bg-[#FFF5F8] shadow-sm"
                          : "border-[#F8D7E3] bg-white hover:bg-[#FFF9FB] hover:border-[#F3BDD3]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#1F191E] truncate">
                          {booking.booking_number}
                        </p>
                        <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FFF0F6] text-[#C52F73]">
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-[#40353B] mt-1 truncate">
                        {customerName}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-[10px] text-[#8D7A84] truncate">
                          {booking.start_date} — {booking.end_date}
                        </span>
                        <span className="text-[11px] font-semibold text-[#E83E8C] shrink-0">
                          {formatRupiah(booking.total || 0)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* DETAIL */}
        <div className="xl:col-span-8">
          {!selectedBooking ? (
            <div className="bg-white border border-[#F8D7E3] rounded-xl min-h-[420px] grid place-items-center">
              <div className="text-center p-8 max-w-sm">
                <div className="h-12 w-12 rounded-xl bg-[#FFF0F6] text-[#E83E8C] grid place-items-center mx-auto">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#1F191E]">
                  Pilih Booking
                </h3>
                <p className="mt-1.5 text-xs text-[#8D7A84] leading-relaxed">
                  Pilih booking di sebelah kiri untuk melihat barang,
                  pembayaran, dan proses rental.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* BOOKING SUMMARY */}
              <SectionCard className="!p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="h-7 w-7 rounded-md border border-[#F8D7E3] grid place-items-center text-[#7A6A75] hover:bg-[#FFF5F8]"
                        title="Kembali ke daftar booking"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <h3 className="text-base font-semibold text-[#1F191E]">
                        {selectedBooking.booking_number}
                      </h3>
                      <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-[#FFF0F6] text-[#C52F73]">
                        {selectedBooking.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2.5">
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#A18895]">Pelanggan</p>
                        <p className="text-xs font-semibold text-[#1F191E] mt-0.5 truncate">{selectedCustomerName}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#A18895]">WhatsApp</p>
                        <p className="text-xs font-semibold text-[#1F191E] mt-0.5 truncate">{selectedCustomerPhone}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#A18895]">Periode Sewa</p>
                        <p className="text-xs font-semibold text-[#1F191E] mt-0.5">{selectedBooking.start_date} — {selectedBooking.end_date}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-[#A18895]">Tanggal Booking</p>
                        <p className="text-xs font-semibold text-[#1F191E] mt-0.5">{selectedBooking.booking_date || "-"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="lg:min-w-[150px] rounded-lg bg-[#FFF7FA] border border-[#FCE4EC] px-3 py-2.5 lg:text-right">
                    <p className="text-[9px] uppercase tracking-wide text-[#A18895]">Total Booking</p>
                    <p className="text-lg font-bold text-[#E83E8C] mt-0.5">{formatRupiah(selectedTotal)}</p>
                  </div>
                </div>
              </SectionCard>

              {/* ITEMS + PAYMENT */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-3">
                  <SectionCard className="!p-4 h-full">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <PackageCheck className="h-4 w-4 text-[#E83E8C]" />
                        <h3 className="text-sm font-semibold text-[#1F191E]">Detail Barang</h3>
                      </div>
                      <span className="text-[10px] text-[#8D7A84]">{bookingItems.length} item</span>
                    </div>

                    {loadingBooking ? (
                      <div className="py-8 text-center text-xs text-[#8D7A84]">Memuat detail booking...</div>
                    ) : bookingItems.length === 0 ? (
                      <EmptyState title="Tidak ada barang" subtitle="Booking ini tidak memiliki item." />
                    ) : (
                      <div className="space-y-2">
                        {bookingItems.map((item, index) => {
                          const imageUrl =
                            item.product?.photo_url ||
                            getProductImage(item.product_id);
                          const qty = Number(item.quantity || 0);
                          const price = Number(item.rental_price || 0);
                          const itemSubtotal = Number(item.subtotal ?? price * qty);

                          return (
                            <div
                              key={item.id || `${item.product_id}-${index}`}
                              className="rounded-lg border border-[#FCE4EC] bg-[#FEFCFD] p-2.5"
                            >
                              <div className="flex gap-3">
                                <div className="h-[92px] w-[76px] rounded-lg overflow-hidden bg-[#FFF5F8] border border-[#FCE4EC] shrink-0 grid place-items-center">
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={item.product?.name || "Produk"}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <PackageCheck className="h-6 w-6 text-[#E8B4C9]" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                                  <div>
                                    <p className="text-sm font-semibold text-[#1F191E] leading-tight">
                                      {item.product?.name || "Produk"}
                                    </p>
                                    {item.product?.product_code && (
                                      <p className="text-[10px] text-[#8D7A84] mt-1">
                                        Kode produk: {item.product.product_code}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-end justify-between gap-2 mt-2">
                                    <div>
                                      <p className="text-[10px] text-[#A18895]">Harga × Qty</p>
                                      <p className="text-xs font-medium text-[#40353B] mt-0.5">
                                        {formatRupiah(price)} × {qty}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[9px] uppercase tracking-wide text-[#A18895]">Subtotal</p>
                                      <p className="text-sm font-bold text-[#E83E8C] mt-0.5">
                                        {formatRupiah(itemSubtotal)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </div>

                <div className="lg:col-span-2">
                  <SectionCard className="!p-4 h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="h-4 w-4 text-[#E83E8C]" />
                      <div>
                        <h3 className="text-sm font-semibold text-[#1F191E]">Pembayaran</h3>
                        <p className="text-[10px] text-[#8D7A84]">Status invoice & penerimaan</p>
                      </div>
                    </div>

                    {loadingBooking ? (
                      <div className="py-8 text-center text-xs text-[#8D7A84]">Memuat invoice...</div>
                    ) : !selectedInvoice ? (
                      <div className="p-3 rounded-lg bg-[#FFF5F8] border border-[#F8D7E3] text-xs text-[#7A6A75]">
                        Invoice untuk booking ini tidak ditemukan.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-lg bg-[#FEFCFD] border border-[#FCE4EC]">
                            <p className="text-[9px] uppercase tracking-wide text-[#A18895]">Total</p>
                            <p className="text-xs font-semibold mt-0.5">{formatRupiah(selectedTotal)}</p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#ECFDF5] border border-[#D1FAE5]">
                            <p className="text-[9px] uppercase tracking-wide text-[#047857]">Dibayar</p>
                            <p className="text-xs font-bold text-[#047857] mt-0.5">{formatRupiah(selectedPaid)}</p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#FFF7FA] border border-[#FCE4EC] col-span-2">
                            <p className="text-[9px] uppercase tracking-wide text-[#A18895]">Sisa Pembayaran</p>
                            <p className="text-base font-bold text-[#B91C1C] mt-0.5">{formatRupiah(selectedRemaining)}</p>
                          </div>
                        </div>

                        {selectedInvoice.status === "CANCELLED" ? (
                          <div className="rounded-lg border border-[#F3D9E4] bg-[#FFF7FA] p-3">
                            <p className="text-xs font-semibold text-[#B91C1C]">Booking dibatalkan</p>
                            <p className="text-[10px] text-[#7A6A75] mt-1">DP yang sudah dibayarkan mengikuti kebijakan DP hangus.</p>
                          </div>
                        ) : selectedRemaining > 0 ? (
                          <div className="rounded-lg border border-[#FCE4EC] bg-white p-3">
                            <div className="grid grid-cols-1 gap-2">
                              <Field label="Jenis Pembayaran">
                                <NativeSelect
                                  value={bookingPayType}
                                  onChange={(e) => setBookingPayType(e.target.value)}
                                  options={[
                                    { value: "DP", label: "DP / Sebagian" },
                                    { value: "FULL", label: "Pelunasan / Full" },
                                  ]}
                                />
                              </Field>
                              <Field label="Jumlah Bayar">
                                <TextInput
                                  type="number"
                                  min="1"
                                  value={bookingPayAmount}
                                  onChange={(e) => setBookingPayAmount(e.target.value)}
                                  placeholder="Masukkan jumlah"
                                />
                              </Field>
                              <Field label="Metode Pembayaran">
                                <NativeSelect
                                  value={bookingPayMethod}
                                  onChange={(e) => setBookingPayMethod(e.target.value)}
                                  options={PAYMENT_METHODS}
                                />
                              </Field>
                            </div>
                            <Btn
                              onClick={payExistingBooking}
                              loading={bookingProcessing}
                              className="w-full mt-3 py-2"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              {bookingPayType === "FULL" ? "Terima Pelunasan" : "Terima DP"}
                            </Btn>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-[#D1FAE5] bg-[#ECFDF5] p-3 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#047857] shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-[#047857]">Pembayaran Lunas</p>
                              <p className="text-[10px] text-[#047857]">Tidak ada sisa pembayaran.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </SectionCard>
                </div>
              </div>

              {/* RENTAL ACTION */}
              <SectionCard className="!p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-[#FFF0F6] text-[#E83E8C] grid place-items-center shrink-0">
                      <PackageCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#1F191E]">Proses Rental</p>
                      <p className="text-[10px] text-[#8D7A84] mt-0.5">Setelah barang diserahkan, ubah booking menjadi rental.</p>
                    </div>
                  </div>
                  <Btn
                    variant="secondary"
                    onClick={checkoutExistingBooking}
                    loading={bookingProcessing}
                    disabled={
                      selectedBooking.status === "CANCELLED" ||
                      selectedBooking.status === "RENTED"
                    }
                    className="sm:min-w-[190px] py-2 text-xs"
                  >
                    <PackageCheck className="h-3.5 w-3.5" />
                    Proses Rental
                  </Btn>
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>

      {/* RESULT */}
      {result && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setResult(null)}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-sm w-full text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="pos-result"
          >
            <div className="h-12 w-12 rounded-full bg-[#ECFDF5] text-[#047857] grid place-items-center mx-auto">
              {result.type === "booking-payment" ? (
                <CreditCard className="h-6 w-6" />
              ) : (
                <Receipt className="h-6 w-6" />
              )}
            </div>
            <h3 className="mt-3 text-base font-bold text-[#1F191E]">
              {result.type === "booking-payment"
                ? result.payment_type === "FULL"
                  ? "Pelunasan Berhasil"
                  : "DP Berhasil"
                : "Rental Berhasil"}
            </h3>
            <div className="mt-3 text-xs text-left space-y-1.5 bg-[#FEFCFD] rounded-lg p-3 border border-[#FCE4EC]">
              {result.booking_number && (
                <p className="flex justify-between gap-3"><span className="text-[#7A6A75]">Booking</span><b>{result.booking_number}</b></p>
              )}
              {result.rental_number && (
                <p className="flex justify-between gap-3"><span className="text-[#7A6A75]">Rental</span><b>{result.rental_number}</b></p>
              )}
              {result.invoice_number && (
                <p className="flex justify-between gap-3"><span className="text-[#7A6A75]">Invoice</span><b>{result.invoice_number}</b></p>
              )}
              <p className="flex justify-between gap-3"><span className="text-[#7A6A75]">Total</span><b className="text-[#E83E8C]">{formatRupiah(result.total || 0)}</b></p>
              <p className="flex justify-between gap-3"><span className="text-[#7A6A75]">Dibayar</span><b className="text-[#047857]">{formatRupiah(result.paid || 0)}</b></p>
              <p className="flex justify-between gap-3"><span className="text-[#7A6A75]">Sisa</span><b className="text-[#B91C1C]">{formatRupiah(result.remaining || 0)}</b></p>
            </div>
            <Btn onClick={() => setResult(null)} className="mt-4 w-full py-2 text-xs">
              Selesai
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
