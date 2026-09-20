import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import {
  listBookings,
  getBooking,
  listCustomers,
  listProducts,
  createBooking,
  updateBooking,
  updateBookingStatus,
  checkoutRental,
  checkAvailability,
} from "@/lib/api";
import {
  formatRupiah,
  formatDateShort,
  todayISO,
  addDays,
} from "@/lib/format";
import { precheckItems, parseNotAvailable } from "@/lib/availability";
import {
  PageHeader,
  SectionCard,
  Loading,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "@/components/common";
import {
  Field,
  TextInput,
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
  Trash2,
  PackageCheck,
  Eye,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

export default function Booking() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [bookings, customers, products] = await Promise.all([
      listBookings(),
      listCustomers(),
      listProducts(),
    ]);

    return {
      bookings,
      customers,
      products,
    };
  }, []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);

  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const bookings = useMemo(
    () => data?.bookings || [],
    [data]
  );

  const customers = data?.customers || [];
  const products = data?.products || [];

  const emptyForm = () => ({
    customer_id: "",
    start_date: todayISO(),
    end_date: addDays(todayISO(), 2),
    event_date: "",
    discount: "",
    deposit: "",
    notes: "",
    items: [],
  });

  const [form, setForm] = useState(emptyForm());

  const filtered = useMemo(
    () =>
      bookings.filter((b) => {
        const okS =
          !search ||
          (b.booking_number || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (b.customer?.name || "")
            .toLowerCase()
            .includes(search.toLowerCase());

        const okF =
          !statusFilter || b.status === statusFilter;

        return okS && okF;
      }),
    [bookings, search, statusFilter]
  );

  /* ------------------------------------------------------------------
     ITEM FORM
  ------------------------------------------------------------------ */

  const addItem = () => {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          product_id: "",
          quantity: 1,
          rental_price: 0,
          _avail: null,
        },
      ],
    }));
  };

  const updateItem = (idx, patch) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === idx ? { ...it, ...patch } : it
      ),
    }));
  };

  const removeItem = (idx) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  };

  const onPickProduct = (idx, productId) => {
    const p = products.find(
      (x) => x.id === productId
    );

    updateItem(idx, {
      product_id: productId,
      rental_price: p?.rental_price || 0,
      _avail: null,
    });
  };

  const checkItem = async (idx) => {
    const it = form.items[idx];

    if (!it?.product_id) {
      toast.error("Pilih produk terlebih dahulu");
      return;
    }

    try {
      const a = await checkAvailability(
        it.product_id,
        form.start_date,
        form.end_date
      );

      updateItem(idx, {
        _avail: a,
      });
    } catch (e) {
      toast.error(
        e.message || "Gagal mengecek availability"
      );
    }
  };

  /* ------------------------------------------------------------------
     TOTAL
  ------------------------------------------------------------------ */

  const subtotal = form.items.reduce(
    (s, it) =>
      s +
      Number(it.rental_price || 0) *
        Number(it.quantity || 1),
    0
  );

  const total = Math.max(
    subtotal - Number(form.discount || 0),
    0
  );

  /* ------------------------------------------------------------------
     CREATE
  ------------------------------------------------------------------ */

  const openCreate = () => {
    setEditing(false);
    setEditingId(null);
    setForm(emptyForm());
    setModal(true);
  };

  /* ------------------------------------------------------------------
     EDIT BOOKING
  ------------------------------------------------------------------ */

  const openEdit = async (booking) => {
    if (
      ["RENTED", "RETURNED", "CANCELLED"].includes(
        booking.status
      )
    ) {
      toast.error(
        "Booking ini sudah tidak dapat diedit"
      );
      return;
    }

    try {
      setSaving(true);

      const full = await getBooking(booking.id);

      setEditing(true);
      setEditingId(full.id);

      setForm({
        customer_id: full.customer_id || "",
        start_date: full.start_date || todayISO(),
        end_date:
          full.end_date || addDays(todayISO(), 2),
        event_date: full.event_date || "",
        discount: full.discount ?? "",
        deposit: full.deposit ?? "",
        notes: full.notes || "",
        items: (full.items || []).map((it) => ({
          product_id: it.product_id,
          quantity: Number(it.quantity || 1),
          rental_price: Number(
            it.rental_price || 0
          ),
          _avail: null,
        })),
      });

      setDetail(null);
      setModal(true);
    } catch (e) {
      toast.error(
        e.message || "Gagal membuka Booking"
      );
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------
     SAVE CREATE / EDIT
  ------------------------------------------------------------------ */

  const save = async () => {
    if (!form.customer_id) {
      toast.error("Pilih pelanggan");
      return;
    }

    if (
      form.items.length === 0 ||
      form.items.some((i) => !i.product_id)
    ) {
      toast.error(
        "Tambahkan minimal 1 produk"
      );
      return;
    }

    if (
      !form.start_date ||
      !form.end_date ||
      form.end_date < form.start_date
    ) {
      toast.error(
        "Tanggal kembali harus setelah tanggal mulai"
      );
      return;
    }

    setSaving(true);

    try {
      /* --------------------------------------------------------------
         CREATE
         -------------------------------------------------------------- */
      if (!editing) {
        const problems = await precheckItems(
          form.items,
          form.start_date,
          form.end_date,
          products
        );

        if (problems.length > 0) {
          problems.forEach((pr) =>
            toast.error(pr.message)
          );

          setForm((f) => ({
            ...f,
            items: f.items.map((it) => {
              const pr = problems.find(
                (x) =>
                  x.product_id === it.product_id
              );

              return pr
                ? {
                    ...it,
                    _avail: {
                      total: pr.total,
                      available:
                        pr.available,
                    },
                  }
                : it;
            }),
          }));

          return;
        }

        await createBooking({
          customer_id: form.customer_id,
          start_date: form.start_date,
          end_date: form.end_date,
          event_date:
            form.event_date || null,
          discount: Number(
            form.discount || 0
          ),
          deposit: Number(
            form.deposit || 0
          ),
          notes: form.notes,
          status: "CONFIRMED",
          items: form.items.map((it) => ({
            product_id: it.product_id,
            quantity: Number(
              it.quantity || 1
            ),
            rental_price: Number(
              it.rental_price || 0
            ),
          })),
        });

        toast.success(
          "Booking berhasil dibuat"
        );

        setModal(false);
        setForm(emptyForm());
        reload();
        return;
      }

      /* --------------------------------------------------------------
         EDIT
         -------------------------------------------------------------- */

      await updateBooking(
        editingId,
        {
          customer_id: form.customer_id,
          start_date: form.start_date,
          end_date: form.end_date,
          event_date:
            form.event_date || null,
          discount: Number(
            form.discount || 0
          ),
          deposit: Number(
            form.deposit || 0
          ),
          notes: form.notes,
          items: form.items.map((it) => ({
            product_id: it.product_id,
            quantity: Number(
              it.quantity || 1
            ),
            rental_price: Number(
              it.rental_price || 0
            ),
          })),
        }
      );

      toast.success(
        "Booking berhasil diperbarui"
      );

      setModal(false);
      setEditing(false);
      setEditingId(null);
      setForm(emptyForm());

      await reload();
    } catch (e) {
      const msg = String(
        e?.message || ""
      );

      if (
        msg.includes("not_available:")
      ) {
        toast.error(
          "Kebaya/item tidak tersedia untuk tanggal tersebut."
        );
      } else if (
        msg.includes("booking_locked:")
      ) {
        toast.error(
          "Booking ini sudah tidak dapat diedit."
        );
      } else if (
        msg.includes(
          "paid_exceeds_new_total"
        )
      ) {
        toast.error(
          "Total baru tidak boleh lebih kecil dari pembayaran yang sudah masuk."
        );
      } else {
        toast.error(
          parseNotAvailable(
            msg,
            products
          ) ||
            msg ||
            "Gagal menyimpan Booking"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------------
     CHECKOUT
  ------------------------------------------------------------------ */

  const doCheckout = async (b) => {
    if (
      !window.confirm(
        `Checkout rental untuk booking ${b.booking_number}?`
      )
    ) {
      return;
    }

    try {
      await checkoutRental(
        b.id,
        todayISO()
      );

      toast.success(
        "Rental dibuat, barang keluar."
      );

      reload();
    } catch (e) {
      toast.error(
        e.message ||
          "Gagal checkout"
      );
    }
  };

  /* ------------------------------------------------------------------
     STATUS
  ------------------------------------------------------------------ */

  const changeStatus = async (
    b,
    status
  ) => {
    try {
      await updateBookingStatus(
        b.id,
        status
      );

      toast.success(
        "Status diperbarui"
      );

      reload();
    } catch (e) {
      toast.error(
        e.message
      );
    }
  };

  /* ------------------------------------------------------------------
     DETAIL
  ------------------------------------------------------------------ */

  const viewDetail = async (b) => {
    try {
      setDetail(
        await getBooking(b.id)
      );
    } catch (e) {
      toast.error(
        e.message
      );
    }
  };

  /* ------------------------------------------------------------------
     LOADING / ERROR
  ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------ */

  return (
    <div data-testid="booking-page">

      <PageHeader
        title="Booking & Jadwal"
        subtitle={`${bookings.length} booking`}
        actions={
          <Btn
            onClick={openCreate}
            data-testid="booking-add-btn"
          >
            <Plus className="h-4 w-4" />
            Buat Booking
          </Btn>
        }
      />

      {/* ============================================================
          LIST BOOKING
      ============================================================ */}

      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nomor / pelanggan…"
            testid="booking-search"
          />

          <NativeSelect
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
            placeholder="Semua Status"
            options={[
              "PENDING",
              "CONFIRMED",
              "READY",
              "PAID",
              "RENTED",
              "RETURNED",
              "CANCELLED",
            ]}
            className="sm:w-48"
          />

        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Belum ada booking"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>No.</Th>
                <Th>Pelanggan</Th>
                <Th>Periode</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th className="text-right">
                  Aksi
                </Th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  className="hover:bg-[#FEFCFD]"
                  data-testid={`booking-row-${b.id}`}
                >
                  <Td className="font-mono text-xs">
                    {b.booking_number}
                  </Td>

                  <Td className="font-medium text-[#1F191E]">
                    {b.customer?.name ||
                      "-"}
                  </Td>

                  <Td className="text-xs">
                    {formatDateShort(
                      b.start_date
                    )}{" "}
                    —{" "}
                    {formatDateShort(
                      b.end_date
                    )}
                  </Td>

                  <Td className="font-semibold">
                    {formatRupiah(
                      b.total
                    )}
                  </Td>

                  <Td>
                    <StatusBadge
                      status={b.status}
                    />
                  </Td>

                  <Td>
                    <div className="flex justify-end gap-1.5">

                      {/* DETAIL */}
                      <Btn
                        variant="ghost"
                        className="px-2 py-1.5"
                        onClick={() =>
                          viewDetail(b)
                        }
                        data-testid={`booking-view-${b.id}`}
                        title="Lihat Detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Btn>

                      {/* EDIT */}
                      {![
                        "RENTED",
                        "RETURNED",
                        "CANCELLED",
                      ].includes(
                        b.status
                      ) && (
                        <Btn
                          variant="ghost"
                          className="px-2 py-1.5 text-[#E83E8C]"
                          onClick={() =>
                            openEdit(b)
                          }
                          data-testid={`booking-edit-${b.id}`}
                          title="Ubah Booking"
                        >
                          <Pencil className="h-4 w-4" />
                        </Btn>
                      )}

                      {/* CHECKOUT */}
                      {[
                        "CONFIRMED",
                        "READY",
                        "PAID",
                      ].includes(
                        b.status
                      ) && (
                        <Btn
                          variant="secondary"
                          className="px-2.5 py-1.5"
                          onClick={() =>
                            doCheckout(b)
                          }
                          data-testid={`booking-checkout-${b.id}`}
                        >
                          <PackageCheck className="h-4 w-4" />
                          Checkout
                        </Btn>
                      )}

                      {/* CONFIRM */}
                      {b.status ===
                        "PENDING" && (
                        <Btn
                          variant="ghost"
                          className="px-2 py-1.5 text-[#047857]"
                          onClick={() =>
                            changeStatus(
                              b,
                              "CONFIRMED"
                            )
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Btn>
                      )}

                      {/* CANCEL */}
                      {![
                        "RENTED",
                        "RETURNED",
                        "CANCELLED",
                      ].includes(
                        b.status
                      ) && (
                        <Btn
                          variant="ghost"
                          className="px-2 py-1.5 text-[#B91C1C]"
                          onClick={() =>
                            changeStatus(
                              b,
                              "CANCELLED"
                            )
                          }
                        >
                          <XCircle className="h-4 w-4" />
                        </Btn>
                      )}

                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </SectionCard>

      {/* ============================================================
          CREATE / EDIT MODAL
      ============================================================ */}

      <Modal
        open={modal}
        onClose={() => {
          if (!saving) {
            setModal(false);
          }
        }}
        title={
          editing
            ? "Ubah Booking"
            : "Buat Booking Baru"
        }
        size="xl"
        footer={
          <>
            <Btn
              variant="outline"
              onClick={() =>
                setModal(false)
              }
              disabled={saving}
            >
              Batal
            </Btn>

            <Btn
              onClick={save}
              loading={saving}
              data-testid="booking-save-btn"
            >
              {editing
                ? "Simpan Perubahan"
                : "Simpan Booking"}{" "}
              ({formatRupiah(total)})
            </Btn>
          </>
        }
      >

        {/* CUSTOMER + DATES */}
        <div className="grid sm:grid-cols-3 gap-4">

          <Field
            label="Pelanggan"
            required
          >
            <NativeSelect
              value={
                form.customer_id
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  customer_id:
                    e.target.value,
                })
              }
              placeholder="Pilih pelanggan"
              options={customers.map(
                (c) => ({
                  value: c.id,
                  label: c.name,
                })
              )}
              data-testid="booking-customer-select"
            />
          </Field>

          <Field
            label="Tgl Mulai"
            required
          >
            <TextInput
              type="date"
              value={
                form.start_date
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  start_date:
                    e.target.value,
                  items:
                    form.items.map(
                      (it) => ({
                        ...it,
                        _avail:
                          null,
                      })
                    ),
                })
              }
              data-testid="booking-start-date"
            />
          </Field>

          <Field
            label="Tgl Kembali"
            required
          >
            <TextInput
              type="date"
              value={
                form.end_date
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  end_date:
                    e.target.value,
                  items:
                    form.items.map(
                      (it) => ({
                        ...it,
                        _avail:
                          null,
                      })
                    ),
                })
              }
              data-testid="booking-end-date"
            />
          </Field>

        </div>

        {/* ITEMS */}
        <div className="mt-5 flex items-center justify-between">

          <p className="text-sm font-semibold text-[#1F191E]">
            Item Produk
          </p>

          <Btn
            variant="secondary"
            className="py-1.5"
            onClick={addItem}
            data-testid="booking-add-item"
          >
            <Plus className="h-4 w-4" />
            Tambah Item
          </Btn>

        </div>

        <div className="mt-3 space-y-3">

          {form.items.length === 0 && (
            <p className="text-sm text-[#7A6A75]">
              Belum ada item.
            </p>
          )}

          {form.items.map(
            (it, idx) => (
              <div
                key={idx}
                className="grid sm:grid-cols-12 gap-2 items-end bg-[#FEFCFD] border border-[#FCE4EC] rounded-lg p-3"
                data-testid={`booking-item-${idx}`}
              >

                <Field
                  label="Produk"
                  className="sm:col-span-5"
                >
                  <NativeSelect
                    value={
                      it.product_id
                    }
                    onChange={(e) =>
                      onPickProduct(
                        idx,
                        e.target.value
                      )
                    }
                    placeholder="Pilih"
                    options={products.map(
                      (p) => ({
                        value: p.id,
                        label: p.name,
                      })
                    )}
                  />
                </Field>

                <Field
                  label="Qty"
                  className="sm:col-span-2"
                >
                  <TextInput
                    type="number"
                    min="1"
                    value={
                      it.quantity
                    }
                    onChange={(e) =>
                      updateItem(
                        idx,
                        {
                          quantity:
                            e.target
                              .value,
                          _avail:
                            null,
                        }
                      )
                    }
                  />
                </Field>

                <Field
                  label="Harga"
                  className="sm:col-span-3"
                >
                  <TextInput
                    type="number"
                    value={
                      it.rental_price
                    }
                    onChange={(e) =>
                      updateItem(
                        idx,
                        {
                          rental_price:
                            e.target
                              .value,
                        }
                      )
                    }
                  />
                </Field>

                <div className="sm:col-span-2 flex gap-1">

                  <Btn
                    variant="outline"
                    className="py-1.5 px-2 text-xs"
                    onClick={() =>
                      checkItem(
                        idx
                      )
                    }
                  >
                    Cek
                  </Btn>

                  <Btn
                    variant="ghost"
                    className="py-1.5 px-2 text-[#B91C1C]"
                    onClick={() =>
                      removeItem(
                        idx
                      )
                    }
                    title="Hapus Item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Btn>

                </div>

                {it._avail && (
                  <p
                    className={`sm:col-span-12 text-xs ${
                      it._avail
                        .available >
                      0
                        ? "text-[#047857]"
                        : "text-[#B91C1C]"
                    }`}
                  >
                    {it._avail
                      .available >
                    0
                      ? `Tersedia ${it._avail.available}/${it._avail.total} unit`
                      : "Tidak tersedia pada tanggal ini"}
                  </p>
                )}

              </div>
            )
          )}

        </div>

        {/* OTHER DATA */}
        <div className="mt-5 grid sm:grid-cols-3 gap-4">

          <Field label="Diskon">
            <TextInput
              type="number"
              value={
                form.discount
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  discount:
                    e.target.value,
                })
              }
            />
          </Field>

          <Field label="Deposit">
            <TextInput
              type="number"
              value={
                form.deposit
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  deposit:
                    e.target.value,
                })
              }
            />
          </Field>

          <Field label="Catatan">
            <TextInput
              value={
                form.notes
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  notes:
                    e.target.value,
                })
              }
            />
          </Field>

        </div>

        {/* TOTAL */}
        <div className="mt-4 flex justify-end gap-6 text-sm">

          <span className="text-[#7A6A75]">
            Subtotal:{" "}
            <b className="text-[#1F191E]">
              {formatRupiah(
                subtotal
              )}
            </b>
          </span>

          <span className="text-[#7A6A75]">
            Total:{" "}
            <b className="text-[#E83E8C]">
              {formatRupiah(
                total
              )}
            </b>
          </span>

        </div>

      </Modal>

      {/* ============================================================
          DETAIL MODAL
      ============================================================ */}

      <Modal
        open={!!detail}
        onClose={() =>
          setDetail(null)
        }
        title={`Detail ${
          detail?.booking_number ||
          ""
        }`}
        size="lg"
        footer={
          detail &&
          ![
            "RENTED",
            "RETURNED",
            "CANCELLED",
          ].includes(
            detail.status
          ) ? (
            <>
              <Btn
                variant="outline"
                onClick={() =>
                  setDetail(null)
                }
              >
                Tutup
              </Btn>

              <Btn
                onClick={() =>
                  openEdit(detail)
                }
              >
                <Pencil className="h-4 w-4" />
                Ubah Booking
              </Btn>
            </>
          ) : (
            <Btn
              variant="outline"
              onClick={() =>
                setDetail(null)
              }
            >
              Tutup
            </Btn>
          )
        }
      >

        {detail && (
          <div className="space-y-4 text-sm">

            <div className="grid grid-cols-2 gap-3">

              <p>
                <span className="text-[#7A6A75]">
                  Pelanggan:
                </span>{" "}
                <b>
                  {detail.customer
                    ?.name}
                </b>
              </p>

              <p>
                <span className="text-[#7A6A75]">
                  Status:
                </span>{" "}
                <StatusBadge
                  status={
                    detail.status
                  }
                />
              </p>

              <p>
                <span className="text-[#7A6A75]">
                  Mulai:
                </span>{" "}
                {formatDateShort(
                  detail.start_date
                )}
              </p>

              <p>
                <span className="text-[#7A6A75]">
                  Kembali:
                </span>{" "}
                {formatDateShort(
                  detail.end_date
                )}
              </p>

            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Produk</Th>
                  <Th>Unit</Th>
                  <Th>Qty</Th>
                  <Th>Harga</Th>
                </tr>
              </thead>

              <tbody>
                {(detail.items ||
                  []).map(
                  (it) => (
                    <tr
                      key={it.id}
                    >
                      <Td>
                        {
                          it.product
                            ?.name
                        }
                      </Td>

                      <Td className="font-mono text-xs">
                        {it.inventory
                          ?.sku ||
                          "-"}
                      </Td>

                      <Td>
                        {
                          it.quantity
                        }
                      </Td>

                      <Td>
                        {formatRupiah(
                          it.rental_price
                        )}
                      </Td>
                    </tr>
                  )
                )}
              </tbody>
            </Table>

            <div className="flex justify-end gap-6">

              <span className="text-[#7A6A75]">
                Subtotal:{" "}
                <b>
                  {formatRupiah(
                    detail.subtotal
                  )}
                </b>
              </span>

              <span className="text-[#7A6A75]">
                Total:{" "}
                <b className="text-[#E83E8C]">
                  {formatRupiah(
                    detail.total
                  )}
                </b>
              </span>

            </div>

          </div>
        )}

      </Modal>

    </div>
  );
}
