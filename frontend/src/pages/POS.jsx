import { useState, useMemo, useEffect } from "react";
import { useAsync } from "@/lib/hooks";
import {
  listCustomers,
  listProducts,
  listBookings,
  getBooking,
  getInvoiceByBooking,
  createBooking,
  checkoutRental,
  addPayment,
  checkAvailability,
} from "@/lib/api";
import { formatRupiah, todayISO, addDays } from "@/lib/format";
import {
  precheckItems,
  parseNotAvailable,
} from "@/lib/availability";
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
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  CalendarSearch,
  Receipt,
  ClipboardList,
  RefreshCw,
  CreditCard,
  PackageCheck,
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
    const [
      customers,
      products,
      bookings,
    ] = await Promise.all([
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

  const [mode, setMode] = useState("new");

  /* ------------------------------ New POS ------------------------------ */
  const [customerId, setCustomerId] = useState("");

  const [range, setRange] = useState({
    start: todayISO(),
    end: addDays(todayISO(), 2),
  });

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [avail, setAvail] = useState({});

  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState(0);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");

  /* ---------------------------- Existing Booking ---------------------- */
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(false);

  const [bookingPayAmount, setBookingPayAmount] = useState("");
  const [bookingPayMethod, setBookingPayMethod] = useState("CASH");

  const [bookingProcessing, setBookingProcessing] = useState(false);

  /* ------------------------------- General ----------------------------- */
  const [processing, setProcessing] = useState(false);
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

  const filtered = useMemo(() => {
    return products.filter(
      (p) =>
        !search ||
        p.name
          .toLowerCase()
          .includes(search.toLowerCase())
    );
  }, [products, search]);

  /* ---------------------------- Booking Filter ------------------------- */
  const activeBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        ![
          "CANCELLED",
          "COMPLETED",
          "RETURNED",
        ].includes(b.status)
    );
  }, [bookings]);

  /* --------------------------- New POS Cart ---------------------------- */
  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find(
        (item) => item.product_id === product.id
      );

      if (existing) {
        return current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          rental_price: product.rental_price,
          quantity: 1,
        },
      ];
    });
  };

  const setQty = (productId, delta) => {
    setCart((current) =>
      current.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity: Math.max(
                1,
                item.quantity + delta
              ),
            }
          : item
      )
    );
  };

  const removeCart = (productId) => {
    setCart((current) =>
      current.filter(
        (item) => item.product_id !== productId
      )
    );
  };

  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.rental_price || 0) *
        item.quantity,
    0
  );

  const total = Math.max(
    0,
    subtotal - Number(discount || 0)
  );

  /* ------------------------- Availability Check ------------------------ */
  const checkAll = async () => {
    if (!range.start || !range.end) {
      toast.error("Tanggal sewa belum lengkap");
      return;
    }

    if (range.end < range.start) {
      toast.error(
        "Tanggal kembali tidak boleh sebelum tanggal mulai"
      );
      return;
    }

    try {
      const resultMap = {};

      await Promise.all(
        products.map(async (product) => {
          resultMap[product.id] =
            await checkAvailability(
              product.id,
              range.start,
              range.end
            );
        })
      );

      setAvail(resultMap);

      toast.success(
        "Ketersediaan diperbarui"
      );
    } catch (e) {
      toast.error(
        e?.message ||
          "Gagal mengecek ketersediaan"
      );
    }
  };

  /* ----------------------------- New Checkout ------------------------- */
  const checkout = async () => {
    if (!customerId) {
      toast.error("Pilih pelanggan dulu");
      return;
    }

    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }

    if (!range.start || !range.end) {
      toast.error("Tanggal sewa belum lengkap");
      return;
    }

    if (range.end < range.start) {
      toast.error(
        "Tanggal kembali tidak boleh sebelum tanggal mulai"
      );
      return;
    }

    setProcessing(true);

    try {
      const problems = await precheckItems(
        cart,
        range.start,
        range.end,
        products
      );

      if (problems.length > 0) {
        problems.forEach((problem) =>
          toast.error(problem.message)
        );

        setAvail((current) => {
          const next = {
            ...current,
          };

          problems.forEach((problem) => {
            next[problem.product_id] = {
              total: problem.total,
              available: problem.available,
            };
          });

          return next;
        });

        return;
      }

      const booking = await createBooking({
        customer_id: customerId,
        start_date: range.start,
        end_date: range.end,
        discount: Number(discount || 0),
        deposit: Number(deposit || 0),
        status: "CONFIRMED",
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          rental_price: Number(
            item.rental_price || 0
          ),
        })),
      });

      const rental = await checkoutRental(
        booking.booking_id,
        todayISO()
      );

      let payInfo = null;

      if (Number(payAmount || 0) > 0) {
        payInfo = await addPayment({
          invoice_id: booking.invoice_id,
          booking_id: booking.booking_id,
          customer_id: customerId,
          amount: Number(payAmount),
          payment_method: payMethod,
          payment_type:
            Number(payAmount) >=
            Number(booking.total || total)
              ? "FULL"
              : "DP",
        });
      }

      setResult({
        type: "new",
        ...booking,
        rental_number:
          rental?.rental_number || "-",
        paid: payInfo?.paid || 0,
        remaining: payInfo
          ? payInfo.remaining
          : Number(booking.total || total),
      });

      toast.success(
        "Transaksi berhasil!"
      );

      setCart([]);
      setDiscount(0);
      setDeposit(0);
      setPayAmount("");
      setCustomerId("");

      await reload();
    } catch (e) {
      const message = String(
        e?.message || ""
      );

      toast.error(
        parseNotAvailable(
          message,
          products
        ) ||
          message ||
          "Transaksi gagal"
      );
    } finally {
      setProcessing(false);
    }
  };

  /* -------------------------- Load Existing Booking ------------------- */
  const loadBooking = async (bookingId) => {
    setSelectedBookingId(bookingId);
    setSelectedBooking(null);
    setSelectedInvoice(null);
    setBookingPayAmount("");

    if (!bookingId) {
      return;
    }

    setLoadingBooking(true);

    try {
      const [
        booking,
        invoice,
      ] = await Promise.all([
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
  };

  /* --------------------------- Booking Payment ------------------------- */
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

    setBookingProcessing(true);

    try {
      const payment = await addPayment({
        invoice_id: selectedInvoice.id,
        booking_id: selectedBooking.id,
        customer_id:
          selectedBooking.customer_id,
        amount,
        payment_method:
          bookingPayMethod,
        payment_type:
          amount >= remaining
            ? "FULL"
            : "DP",
      });

      toast.success(
        "Pembayaran booking berhasil"
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
          Number(selectedInvoice.paid || 0) +
            amount,
        remaining:
          payment?.remaining ??
          Math.max(
            0,
            remaining - amount
          ),
      });

      await reload();

      const refreshedInvoice =
        await getInvoiceByBooking(
          selectedBooking.id
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

  /* ---------------------------- Checkout Booking ---------------------- */
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
        "RENTED"
      ) {
        toast.info(
          "Booking ini sudah menjadi rental"
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

        const refreshedBooking =
          await getBooking(
            selectedBooking.id
          );

        const refreshedInvoice =
          await getInvoiceByBooking(
            selectedBooking.id
          );

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

  /* -------------------------- Customer Name ---------------------------- */
  const getCustomerName = (customerId) => {
    const customer = customers.find(
      (item) => item.id === customerId
    );

    return customer?.name || "-";
  };

  /* -------------------------- Booking Items ---------------------------- */
  const bookingItems =
    selectedBooking?.items || [];

  /* ----------------------------- Reset Mode ---------------------------- */
  const switchMode = (nextMode) => {
    setMode(nextMode);

    if (nextMode === "new") {
      setSelectedBookingId("");
      setSelectedBooking(null);
      setSelectedInvoice(null);
      setBookingPayAmount("");
    }
  };

  /* ---------------------------- Loading/Error -------------------------- */
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
        subtitle="Transaksi sewa cepat dan terhubung dengan Booking."
      />

      {/* =========================== MODE TABS =========================== */}
      <div className="mb-5">
        <div className="bg-white border border-[#F8D7E3] rounded-xl p-1.5 flex flex-col sm:flex-row gap-1.5">
          <button
            type="button"
            onClick={() =>
              switchMode("new")
            }
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              mode === "new"
                ? "bg-[#E83E8C] text-white shadow-sm"
                : "text-[#7A6A75] hover:bg-[#FFF5F8]"
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            Transaksi Baru
          </button>

          <button
            type="button"
            onClick={() =>
              switchMode("booking")
            }
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              mode === "booking"
                ? "bg-[#E83E8C] text-white shadow-sm"
                : "text-[#7A6A75] hover:bg-[#FFF5F8]"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Lanjutkan Booking
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* ========================== NEW POS ============================== */}
      {/* ================================================================= */}
      {mode === "new" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ------------------------ Product Side ----------------------- */}
          <div className="lg:col-span-7 space-y-4">
            <SectionCard>
              <div className="grid sm:grid-cols-4 gap-3 items-end">
                <Field
                  label="Pelanggan"
                  className="sm:col-span-2"
                >
                  <NativeSelect
                    value={customerId}
                    onChange={(e) =>
                      setCustomerId(
                        e.target.value
                      )
                    }
                    placeholder="Pilih pelanggan"
                    options={customers.map(
                      (customer) => ({
                        value: customer.id,
                        label: customer.name,
                      })
                    )}
                    data-testid="pos-customer-select"
                  />
                </Field>

                <Field label="Tgl Mulai">
                  <TextInput
                    type="date"
                    value={range.start}
                    onChange={(e) =>
                      setRange({
                        ...range,
                        start: e.target.value,
                      })
                    }
                    data-testid="pos-start-date"
                  />
                </Field>

                <Field label="Tgl Kembali">
                  <TextInput
                    type="date"
                    value={range.end}
                    onChange={(e) =>
                      setRange({
                        ...range,
                        end: e.target.value,
                      })
                    }
                    data-testid="pos-end-date"
                  />
                </Field>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-3">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Cari produk..."
                  testid="pos-search"
                />

                <Btn
                  variant="secondary"
                  onClick={checkAll}
                  data-testid="pos-check-availability"
                >
                  <CalendarSearch className="h-4 w-4" />
                  Cek Ketersediaan
                </Btn>
              </div>
            </SectionCard>

            {/* ----------------------- Products -------------------------- */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((product) => {
                const availability =
                  avail[product.id];

                const disabled =
                  availability &&
                  availability.available <= 0;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() =>
                      addToCart(product)
                    }
                    disabled={disabled}
                    data-testid={`pos-product-${product.id}`}
                    className="text-left bg-white border border-[#F8D7E3] rounded-xl overflow-hidden hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="aspect-square bg-[#FFF5F8]">
                      {product.photo_url ? (
                        <img
                          src={product.photo_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full grid place-items-center text-[#E0A8C0] text-xs">
                          No Foto
                        </div>
                      )}
                    </div>

                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-[#1F191E] truncate">
                        {product.name}
                      </p>

                      <p className="text-[#E83E8C] font-bold text-sm">
                        {formatRupiah(
                          product.rental_price
                        )}
                      </p>

                      {availability && (
                        <p
                          className={`text-[10px] ${
                            availability.available >
                            0
                              ? "text-[#047857]"
                              : "text-[#B91C1C]"
                          }`}
                        >
                          {availability.available >
                          0
                            ? `Tersedia ${availability.available}`
                            : "Habis"}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ------------------------- Cart ------------------------------ */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-[#F8D7E3] rounded-xl shadow-sm sticky top-20">
              <div className="px-5 py-4 border-b border-[#FCE4EC] flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#E83E8C]" />

                <h3 className="font-semibold text-[#1F191E]">
                  Keranjang
                </h3>

                <span className="ml-auto text-xs text-[#7A6A75]">
                  {cart.length} item
                </span>
              </div>

              <div className="p-5 max-h-[320px] overflow-y-auto">
                {cart.length === 0 ? (
                  <EmptyState
                    title="Keranjang kosong"
                    subtitle="Pilih produk di sebelah kiri."
                  />
                ) : (
                  <div
                    className="space-y-3"
                    data-testid="pos-cart"
                  >
                    {cart.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex items-center gap-2"
                        data-testid={`pos-cart-item-${item.product_id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#1F191E] truncate">
                            {item.name}
                          </p>

                          <p className="text-xs text-[#7A6A75]">
                            {formatRupiah(
                              item.rental_price
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setQty(
                                item.product_id,
                                -1
                              )
                            }
                            className="h-6 w-6 rounded bg-[#FFF5F8] text-[#E83E8C] grid place-items-center"
                          >
                            <Minus className="h-3 w-3" />
                          </button>

                          <span className="w-6 text-center text-sm font-medium">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setQty(
                                item.product_id,
                                1
                              )
                            }
                            className="h-6 w-6 rounded bg-[#FFF5F8] text-[#E83E8C] grid place-items-center"
                          >
                            <Plus className="h-3 w-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeCart(
                                item.product_id
                              )
                            }
                            className="h-6 w-6 rounded text-[#B91C1C] grid place-items-center"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t border-[#FCE4EC] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Diskon">
                    <TextInput
                      type="number"
                      value={discount}
                      onChange={(e) =>
                        setDiscount(
                          e.target.value
                        )
                      }
                      data-testid="pos-discount"
                    />
                  </Field>

                  <Field label="Deposit">
                    <TextInput
                      type="number"
                      value={deposit}
                      onChange={(e) =>
                        setDeposit(
                          e.target.value
                        )
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bayar">
                    <TextInput
                      type="number"
                      value={payAmount}
                      onChange={(e) =>
                        setPayAmount(
                          e.target.value
                        )
                      }
                      placeholder="0 = belum bayar"
                      data-testid="pos-pay-amount"
                    />
                  </Field>

                  <Field label="Metode">
                    <NativeSelect
                      value={payMethod}
                      onChange={(e) =>
                        setPayMethod(
                          e.target.value
                        )
                      }
                      options={
                        PAYMENT_METHODS
                      }
                    />
                  </Field>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-[#7A6A75]">
                    Subtotal
                  </span>

                  <span>
                    {formatRupiah(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between text-base font-bold">
                  <span className="text-[#1F191E]">
                    Total
                  </span>

                  <span className="text-[#E83E8C]">
                    {formatRupiah(total)}
                  </span>
                </div>

                <Btn
                  onClick={checkout}
                  loading={processing}
                  className="w-full py-2.5"
                  data-testid="pos-checkout-btn"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Proses Transaksi
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* ======================= EXISTING BOOKING ======================== */}
      {/* ================================================================= */}
      {mode === "booking" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* --------------------- Booking List -------------------------- */}
          <div className="lg:col-span-5">
            <SectionCard>
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="h-5 w-5 text-[#E83E8C]" />

                <div>
                  <h3 className="font-semibold text-[#1F191E]">
                    Booking
                  </h3>

                  <p className="text-xs text-[#7A6A75]">
                    Pilih booking untuk dilanjutkan
                  </p>
                </div>

                <button
                  type="button"
                  onClick={reload}
                  className="ml-auto h-8 w-8 rounded-lg hover:bg-[#FFF5F8] grid place-items-center text-[#E83E8C]"
                  title="Refresh booking"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {activeBookings.length === 0 ? (
                <EmptyState
                  title="Belum ada booking"
                  subtitle="Booking aktif akan muncul di sini."
                />
              ) : (
                <div className="space-y-2 max-h-[560px] overflow-y-auto">
                  {activeBookings.map(
                    (booking) => {
                      const active =
                        selectedBookingId ===
                        booking.id;

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() =>
                            loadBooking(
                              booking.id
                            )
                          }
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            active
                              ? "border-[#E83E8C] bg-[#FFF5F8]"
                              : "border-[#F8D7E3] bg-white hover:bg-[#FFF9FB]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-[#1F191E]">
                                {
                                  booking.booking_number
                                }
                              </p>

                              <p className="text-xs text-[#7A6A75] truncate mt-0.5">
                                {getCustomerName(
                                  booking.customer_id
                                )}
                              </p>
                            </div>

                            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#FCE4EC] text-[#C52F73]">
                              {booking.status}
                            </span>
                          </div>

                          <div className="mt-2 flex justify-between text-xs">
                            <span className="text-[#7A6A75]">
                              {booking.start_date} —{" "}
                              {booking.end_date}
                            </span>

                            <span className="font-semibold text-[#E83E8C]">
                              {formatRupiah(
                                booking.total
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

          {/* -------------------- Booking Detail ------------------------- */}
          <div className="lg:col-span-7">
            {!selectedBooking ? (
              <div className="bg-white border border-[#F8D7E3] rounded-xl min-h-[400px] grid place-items-center">
                <div className="text-center p-8">
                  <ClipboardList className="h-12 w-12 text-[#E8B4C9] mx-auto" />

                  <h3 className="mt-4 font-semibold text-[#1F191E]">
                    Pilih Booking
                  </h3>

                  <p className="mt-1 text-sm text-[#7A6A75]">
                    Pilih booking di sebelah kiri untuk melihat detail, pembayaran, dan proses rental.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ---------------- Booking Header ---------------------- */}
                <SectionCard>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-[#E83E8C]" />

                        <h3 className="font-bold text-lg text-[#1F191E]">
                          {
                            selectedBooking.booking_number
                          }
                        </h3>
                      </div>

                      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-[#7A6A75]">
                            Pelanggan
                          </p>

                          <p className="font-semibold text-[#1F191E]">
                            {selectedBooking.customer?.name ||
                              getCustomerName(
                                selectedBooking.customer_id
                              )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#7A6A75]">
                            Status
                          </p>

                          <p className="font-semibold text-[#E83E8C]">
                            {
                              selectedBooking.status
                            }
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#7A6A75]">
                            Periode Sewa
                          </p>

                          <p className="font-medium">
                            {
                              selectedBooking.start_date
                            }{" "}
                            —{" "}
                            {
                              selectedBooking.end_date
                            }
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#7A6A75]">
                            Tanggal Booking
                          </p>

                          <p className="font-medium">
                            {
                              selectedBooking.booking_date
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                {/* ---------------- Booking Items ----------------------- */}
                <SectionCard>
                  <div className="flex items-center gap-2 mb-4">
                    <PackageCheck className="h-5 w-5 text-[#E83E8C]" />

                    <h3 className="font-semibold text-[#1F191E]">
                      Detail Barang
                    </h3>
                  </div>

                  {bookingItems.length === 0 ? (
                    <EmptyState
                      title="Tidak ada barang"
                      subtitle="Booking ini tidak memiliki item."
                    />
                  ) : (
                    <div className="space-y-2">
                      {bookingItems.map(
                        (item, index) => (
                          <div
                            key={
                              item.id ||
                              `${item.product_id}-${index}`
                            }
                            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#FEFCFD] border border-[#FCE4EC]"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#1F191E]">
                                {item.product?.name ||
                                  "Produk"}
                              </p>

                              {item.product
                                ?.product_code && (
                                <p className="text-[11px] text-[#7A6A75]">
                                  {
                                    item.product
                                      .product_code
                                  }
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                x
                                {
                                  item.quantity
                                }
                              </p>

                              <p className="text-xs text-[#E83E8C]">
                                {formatRupiah(
                                  item.subtotal ||
                                    Number(
                                      item.rental_price ||
                                        0
                                    ) *
                                      Number(
                                        item.quantity ||
                                          0
                                      )
                                )}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </SectionCard>

                {/* ---------------- Payment ----------------------------- */}
                <SectionCard>
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-[#E83E8C]" />

                    <h3 className="font-semibold text-[#1F191E]">
                      Pembayaran
                    </h3>
                  </div>

                  {loadingBooking ? (
                    <div className="py-8 text-center text-sm text-[#7A6A75]">
                      Memuat invoice...
                    </div>
                  ) : !selectedInvoice ? (
                    <div className="p-4 rounded-lg bg-[#FFF5F8] border border-[#F8D7E3] text-sm text-[#7A6A75]">
                      Invoice untuk booking ini tidak ditemukan.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-[#FEFCFD] border border-[#FCE4EC]">
                          <p className="text-[11px] text-[#7A6A75]">
                            Invoice
                          </p>

                          <p className="text-sm font-semibold mt-1">
                            {
                              selectedInvoice.invoice_number
                            }
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-[#FEFCFD] border border-[#FCE4EC]">
                          <p className="text-[11px] text-[#7A6A75]">
                            Total
                          </p>

                          <p className="text-sm font-semibold mt-1">
                            {formatRupiah(
                              selectedInvoice.total
                            )}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-[#FEFCFD] border border-[#FCE4EC]">
                          <p className="text-[11px] text-[#7A6A75]">
                            Terbayar
                          </p>

                          <p className="text-sm font-semibold text-[#047857] mt-1">
                            {formatRupiah(
                              selectedInvoice.paid ||
                                0
                            )}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-[#FFF5F8] border border-[#F8D7E3]">
                          <p className="text-[11px] text-[#7A6A75]">
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

                      {Number(
                        selectedInvoice.remaining || 0
                      ) > 0 && (
                        <div className="grid sm:grid-cols-2 gap-3">
                          <Field label="Jumlah Bayar">
                            <TextInput
                              type="number"
                              value={
                                bookingPayAmount
                              }
                              onChange={(e) =>
                                setBookingPayAmount(
                                  e.target.value
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
                                  e.target.value
                                )
                              }
                              options={
                                PAYMENT_METHODS
                              }
                            />
                          </Field>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        {Number(
                          selectedInvoice.remaining ||
                            0
                        ) > 0 && (
                          <Btn
                            onClick={
                              payExistingBooking
                            }
                            loading={
                              bookingProcessing
                            }
                            className="flex-1"
                          >
                            <CreditCard className="h-4 w-4" />
                            Terima Pembayaran
                          </Btn>
                        )}

                        {selectedBooking.status !==
                          "RENTED" &&
                          selectedBooking.status !==
                            "CANCELLED" && (
                            <Btn
                              variant="secondary"
                              onClick={
                                checkoutExistingBooking
                              }
                              loading={
                                bookingProcessing
                              }
                              className="flex-1"
                            >
                              <PackageCheck className="h-4 w-4" />
                              Proses Rental
                            </Btn>
                          )}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* =========================== RESULT ============================= */}
      {/* ================================================================= */}
      {result && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
          onClick={() =>
            setResult(null)
          }
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-sm w-full text-center"
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
                ? "Pembayaran Berhasil"
                : result.type ===
                  "booking-checkout"
                ? "Rental Berhasil"
                : "Transaksi Berhasil"}
            </h3>

            <div className="mt-4 text-sm text-left space-y-1.5 bg-[#FEFCFD] rounded-lg p-4 border border-[#FCE4EC]">
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
