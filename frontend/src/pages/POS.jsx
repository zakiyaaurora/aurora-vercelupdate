import { useState, useMemo } from "react";
import { useAsync } from "@/lib/hooks";
import {
  listCustomers, listProducts, createBooking, checkoutRental, addPayment, checkAvailability,
} from "@/lib/api";
import { formatRupiah, todayISO, addDays } from "@/lib/format";
import { PageHeader, SectionCard, Loading, ErrorState, EmptyState } from "@/components/common";
import { Field, TextInput, NativeSelect, Btn, SearchInput } from "@/components/form";
import { PAYMENT_METHODS } from "@/lib/constants";
import { ShoppingBag, Plus, Minus, Trash2, CheckCircle2, User, CalendarSearch, Receipt } from "lucide-react";
import { toast } from "sonner";

export default function POS() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [customers, products] = await Promise.all([listCustomers(), listProducts()]);
    return { customers, products };
  }, []);

  const [customerId, setCustomerId] = useState("");
  const [range, setRange] = useState({ start: todayISO(), end: addDays(todayISO(), 2) });
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [avail, setAvail] = useState({});
  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const customers = data?.customers || [];
  const products = useMemo(() => data?.products || [], [data]);
  const filtered = useMemo(() => products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())), [products, search]);

  const checkAll = async () => {
    try {
      const res = {};
      await Promise.all(products.map(async (p) => { res[p.id] = await checkAvailability(p.id, range.start, range.end); }));
      setAvail(res);
      toast.success("Ketersediaan diperbarui");
    } catch (e) { toast.error(e.message); }
  };

  const addToCart = (p) => {
    setCart((c) => {
      const ex = c.find((it) => it.product_id === p.id);
      if (ex) return c.map((it) => it.product_id === p.id ? { ...it, quantity: it.quantity + 1 } : it);
      return [...c, { product_id: p.id, name: p.name, rental_price: p.rental_price, quantity: 1 }];
    });
  };
  const setQty = (pid, delta) => setCart((c) => c.map((it) => it.product_id === pid ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
  const removeCart = (pid) => setCart((c) => c.filter((it) => it.product_id !== pid));

  const subtotal = cart.reduce((s, it) => s + Number(it.rental_price) * it.quantity, 0);
  const total = subtotal - Number(discount || 0);

  const checkout = async () => {
    if (!customerId) { toast.error("Pilih pelanggan dulu"); return; }
    if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
    setProcessing(true);
    try {
      const booking = await createBooking({
        customer_id: customerId, start_date: range.start, end_date: range.end,
        discount: Number(discount || 0), deposit: Number(deposit || 0), status: "CONFIRMED",
        items: cart.map((it) => ({ product_id: it.product_id, quantity: it.quantity, rental_price: Number(it.rental_price) })),
      });
      const rental = await checkoutRental(booking.booking_id, todayISO());
      let payInfo = null;
      if (Number(payAmount || 0) > 0) {
        payInfo = await addPayment({
          invoice_id: booking.invoice_id, amount: Number(payAmount),
          payment_method: payMethod, payment_type: Number(payAmount) >= total ? "FULL" : "DP",
        });
      }
      setResult({ ...booking, rental_number: rental.rental_number, paid: payInfo?.paid || 0, remaining: payInfo ? payInfo.remaining : total });
      toast.success("Transaksi berhasil!");
      setCart([]); setDiscount(0); setDeposit(0); setPayAmount(""); setCustomerId("");
      reload();
    } catch (e) {
      const msg = String(e.message || "");
      if (msg.includes("not_available")) toast.error("Ada produk yang tidak tersedia pada tanggal tersebut.");
      else toast.error(msg || "Transaksi gagal");
    } finally { setProcessing(false); }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div data-testid="pos-page">
      <PageHeader title="POS / Kasir" subtitle="Transaksi sewa cepat & terhubung penuh." />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: catalog */}
        <div className="lg:col-span-7 space-y-4">
          <SectionCard>
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <Field label="Pelanggan" className="sm:col-span-2"><NativeSelect value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Pilih pelanggan" options={customers.map((c) => ({ value: c.id, label: c.name }))} data-testid="pos-customer-select" /></Field>
              <Field label="Tgl Mulai"><TextInput type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} data-testid="pos-start-date" /></Field>
              <Field label="Tgl Kembali"><TextInput type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} data-testid="pos-end-date" /></Field>
            </div>
            <div className="mt-3 flex gap-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Cari produk…" testid="pos-search" />
              <Btn variant="secondary" onClick={checkAll} data-testid="pos-check-availability"><CalendarSearch className="h-4 w-4" /> Cek Ketersediaan</Btn>
            </div>
          </SectionCard>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((p) => {
              const a = avail[p.id];
              const disabled = a && a.available <= 0;
              return (
                <button key={p.id} onClick={() => addToCart(p)} disabled={disabled} data-testid={`pos-product-${p.id}`}
                  className="text-left bg-white border border-[#F8D7E3] rounded-xl overflow-hidden hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <div className="aspect-square bg-[#FFF5F8]">
                    {p.photo_url ? <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center text-[#E0A8C0] text-xs">No Foto</div>}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-[#1F191E] truncate">{p.name}</p>
                    <p className="text-[#E83E8C] font-bold text-sm">{formatRupiah(p.rental_price)}</p>
                    {a && <p className={`text-[10px] ${a.available > 0 ? "text-[#047857]" : "text-[#B91C1C]"}`}>{a.available > 0 ? `Tersedia ${a.available}` : "Habis"}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: cart */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-[#F8D7E3] rounded-xl shadow-sm sticky top-20">
            <div className="px-5 py-4 border-b border-[#FCE4EC] flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-[#E83E8C]" />
              <h3 className="font-semibold text-[#1F191E]">Keranjang</h3>
              <span className="ml-auto text-xs text-[#7A6A75]">{cart.length} item</span>
            </div>
            <div className="p-5 max-h-[320px] overflow-y-auto">
              {cart.length === 0 ? <EmptyState title="Keranjang kosong" subtitle="Pilih produk di sebelah kiri." /> : (
                <div className="space-y-3" data-testid="pos-cart">
                  {cart.map((it) => (
                    <div key={it.product_id} className="flex items-center gap-2" data-testid={`pos-cart-item-${it.product_id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1F191E] truncate">{it.name}</p>
                        <p className="text-xs text-[#7A6A75]">{formatRupiah(it.rental_price)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setQty(it.product_id, -1)} className="h-6 w-6 rounded bg-[#FFF5F8] text-[#E83E8C] grid place-items-center"><Minus className="h-3 w-3" /></button>
                        <span className="w-6 text-center text-sm font-medium">{it.quantity}</span>
                        <button onClick={() => setQty(it.product_id, 1)} className="h-6 w-6 rounded bg-[#FFF5F8] text-[#E83E8C] grid place-items-center"><Plus className="h-3 w-3" /></button>
                        <button onClick={() => removeCart(it.product_id)} className="h-6 w-6 rounded text-[#B91C1C] grid place-items-center"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[#FCE4EC] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Diskon"><TextInput type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} data-testid="pos-discount" /></Field>
                <Field label="Deposit"><TextInput type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bayar"><TextInput type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0 = belum bayar" data-testid="pos-pay-amount" /></Field>
                <Field label="Metode"><NativeSelect value={payMethod} onChange={(e) => setPayMethod(e.target.value)} options={PAYMENT_METHODS} /></Field>
              </div>
              <div className="flex justify-between text-sm"><span className="text-[#7A6A75]">Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
              <div className="flex justify-between text-base font-bold"><span className="text-[#1F191E]">Total</span><span className="text-[#E83E8C]">{formatRupiah(total)}</span></div>
              <Btn onClick={checkout} loading={processing} className="w-full py-2.5" data-testid="pos-checkout-btn"><CheckCircle2 className="h-4 w-4" /> Proses Transaksi</Btn>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6" onClick={() => setResult(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()} data-testid="pos-result">
            <div className="h-14 w-14 rounded-full bg-[#ECFDF5] text-[#047857] grid place-items-center mx-auto"><Receipt className="h-7 w-7" /></div>
            <h3 className="mt-4 text-lg font-bold text-[#1F191E]">Transaksi Berhasil</h3>
            <div className="mt-4 text-sm text-left space-y-1.5 bg-[#FEFCFD] rounded-lg p-4 border border-[#FCE4EC]">
              <p className="flex justify-between"><span className="text-[#7A6A75]">Booking</span><b>{result.booking_number}</b></p>
              <p className="flex justify-between"><span className="text-[#7A6A75]">Rental</span><b>{result.rental_number}</b></p>
              <p className="flex justify-between"><span className="text-[#7A6A75]">Invoice</span><b>{result.invoice_number}</b></p>
              <p className="flex justify-between"><span className="text-[#7A6A75]">Total</span><b className="text-[#E83E8C]">{formatRupiah(result.total)}</b></p>
              <p className="flex justify-between"><span className="text-[#7A6A75]">Dibayar</span><b className="text-[#047857]">{formatRupiah(result.paid)}</b></p>
              <p className="flex justify-between"><span className="text-[#7A6A75]">Sisa</span><b className="text-[#B91C1C]">{formatRupiah(result.remaining)}</b></p>
            </div>
            <Btn onClick={() => setResult(null)} className="mt-5 w-full">Selesai</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
