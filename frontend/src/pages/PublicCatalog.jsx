
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "@/lib/hooks";
import {
  publicCatalog,
  catalogAvailability,
  checkAvailability,
  submitCustomerRequest,
} from "@/lib/api";
import { todayISO, addDays, formatDateShort } from "@/lib/format";
import { availabilityText } from "@/lib/availability";
import { useAuth } from "@/context/AuthContext";
import { Loading, ErrorState, EmptyState } from "@/components/common";
import { Field, TextInput, NativeSelect, Btn, SearchInput } from "@/components/form";
import CatalogCard from "@/components/CatalogCard";
import ScheduleModal from "@/components/ScheduleModal";
import {
  Sparkles,
  CalendarSearch,
  LogIn,
  LayoutDashboard,
  ShieldCheck,
  ClipboardList,
  X,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  province: "",
  postal_code: "",
  rental_start_date: "",
  rental_end_date: "",
  event_date: "",
  fulfillment_method: "PICKUP",
  fitting_method: "UNDECIDED",
  fitting_date: "",
  fitting_time: "",
  notes: "",
  terms_accepted: false,
};

const inputClass =
  "w-full rounded-xl border border-[#F3CEDD] bg-white px-3.5 py-3 text-sm text-[#1F191E] outline-none transition focus:border-[#E83E8C] focus:ring-2 focus:ring-pink-100";

function RequestField({ label, children, required = false }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-[#4A3F47]">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function RequestForm({ product, initialStart, initialEnd, onClose }) {
  const [form, setForm] = useState({
    ...emptyForm,
    rental_start_date: initialStart || todayISO(),
    rental_end_date: initialEnd || addDays(todayISO(), 2),
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!product?.id) {
      toast.error("Produk kebaya tidak ditemukan.");
      return;
    }

    if (!form.name.trim() || !form.phone.trim() || !form.whatsapp.trim()) {
      toast.error("Nama, nomor telepon, dan WhatsApp wajib diisi.");
      return;
    }

    if (
      !form.address.trim() ||
      !form.city.trim() ||
      !form.province.trim() ||
      !form.postal_code.trim()
    ) {
      toast.error("Lengkapi alamat, kota, provinsi, dan kode pos.");
      return;
    }

    if (
      !form.rental_start_date ||
      !form.rental_end_date ||
      !form.event_date
    ) {
      toast.error("Tanggal sewa dan tanggal acara wajib diisi.");
      return;
    }

    if (form.rental_end_date < form.rental_start_date) {
      toast.error("Tanggal selesai sewa tidak boleh sebelum tanggal mulai.");
      return;
    }

    if (
      form.event_date < form.rental_start_date ||
      form.event_date > form.rental_end_date
    ) {
      toast.error("Tanggal acara harus berada dalam periode sewa.");
      return;
    }

    if (
      form.fitting_method === "OFFLINE" &&
      !form.fitting_date
    ) {
      toast.error("Isi tanggal fitting untuk fitting langsung.");
      return;
    }

    if (!form.terms_accepted) {
      toast.error("Setujui syarat pengajuan terlebih dahulu.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        postal_code: form.postal_code.trim(),
        product_id: product.id,
        rental_start_date: form.rental_start_date,
        rental_end_date: form.rental_end_date,
        event_date: form.event_date,
        fulfillment_method: form.fulfillment_method,
        fitting_method: form.fitting_method,
        fitting_date:
          form.fitting_method === "OFFLINE"
            ? form.fitting_date || null
            : null,
        fitting_time:
          form.fitting_method === "OFFLINE"
            ? form.fitting_time || null
            : null,
        notes: form.notes.trim() || null,
        terms_accepted: true,
      };

      const result = await submitCustomerRequest(payload);

      if (result?.success === false) {
        throw new Error(
          result.message || "Pengajuan belum berhasil dikirim."
        );
      }

      toast.success(
        result?.message ||
          "Pengajuan berhasil dikirim. Silakan tunggu konfirmasi admin."
      );
      onClose();
    } catch (error) {
      console.error("Customer Request gagal dikirim:", error);
      toast.error(
        error?.message ||
          "Pengajuan gagal dikirim. Silakan coba kembali."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-request-title"
        className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#FCE4EC] bg-white p-5 sm:p-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
              <ClipboardList size={14} />
              FORMULIR PENGAJUAN SEWA
            </div>
            <h2
              id="customer-request-title"
              className="text-xl font-bold text-[#1F191E] sm:text-2xl"
            >
              Ajukan Sewa Kebaya
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Isi data berikut. Pengajuan akan diperiksa oleh admin Aurora.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Tutup formulir"
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 p-5 sm:p-6">
          <div className="rounded-2xl border border-pink-100 bg-[#FFFAFC] p-4">
            <p className="text-xs font-medium text-gray-500">
              Kebaya yang dipilih
            </p>
            <p className="mt-1 font-bold text-[#1F191E]">
              {product.name}
            </p>
            {product.product_code && (
              <p className="mt-1 text-xs text-gray-500">
                Kode: {product.product_code}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Pengajuan belum berarti booking sudah dikonfirmasi.
            </p>
          </div>

          <section>
            <h3 className="mb-4 font-bold text-[#1F191E]">
              1. Data Calon Pelanggan
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <RequestField label="Nama lengkap" required>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  maxLength={150}
                  autoComplete="name"
                  required
                  placeholder="Nama sesuai identitas"
                />
              </RequestField>

              <RequestField label="Nomor telepon" required>
                <input
                  className={inputClass}
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  maxLength={30}
                  autoComplete="tel"
                  required
                  placeholder="Contoh: 081234567890"
                />
              </RequestField>

              <RequestField label="Nomor WhatsApp" required>
                <input
                  className={inputClass}
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => update("whatsapp", e.target.value)}
                  maxLength={30}
                  autoComplete="tel"
                  required
                  placeholder="Nomor WhatsApp aktif"
                />
              </RequestField>

              <RequestField label="Email (opsional)">
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  placeholder="nama@email.com"
                />
              </RequestField>
            </div>
          </section>

          <section className="border-t border-gray-100 pt-5">
            <h3 className="mb-4 font-bold text-[#1F191E]">
              2. Alamat
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <RequestField label="Alamat lengkap" required>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    maxLength={500}
                    autoComplete="street-address"
                    required
                    placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan..."
                  />
                </RequestField>
              </div>

              <RequestField label="Kota/Kabupaten" required>
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  maxLength={100}
                  required
                  autoComplete="address-level2"
                  placeholder="Kota atau kabupaten"
                />
              </RequestField>

              <RequestField label="Provinsi" required>
                <input
                  className={inputClass}
                  value={form.province}
                  onChange={(e) => update("province", e.target.value)}
                  maxLength={100}
                  required
                  autoComplete="address-level1"
                  placeholder="Provinsi"
                />
              </RequestField>

              <RequestField label="Kode pos" required>
                <input
                  className={inputClass}
                  value={form.postal_code}
                  onChange={(e) => update("postal_code", e.target.value)}
                  maxLength={15}
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="Kode pos"
                />
              </RequestField>
            </div>
          </section>

          <section className="border-t border-gray-100 pt-5">
            <h3 className="mb-4 font-bold text-[#1F191E]">
              3. Jadwal Sewa
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <RequestField label="Tanggal mulai sewa" required>
                <input
                  className={inputClass}
                  type="date"
                  value={form.rental_start_date}
                  min={todayISO()}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      rental_start_date: e.target.value,
                      rental_end_date:
                        current.rental_end_date < e.target.value
                          ? e.target.value
                          : current.rental_end_date,
                    }))
                  }
                  required
                />
              </RequestField>

              <RequestField label="Tanggal selesai sewa" required>
                <input
                  className={inputClass}
                  type="date"
                  value={form.rental_end_date}
                  min={form.rental_start_date}
                  onChange={(e) =>
                    update("rental_end_date", e.target.value)
                  }
                  required
                />
              </RequestField>

              <div className="sm:col-span-2">
                <RequestField label="Tanggal acara/pemakaian" required>
                  <input
                    className={inputClass}
                    type="date"
                    value={form.event_date}
                    min={form.rental_start_date}
                    max={form.rental_end_date}
                    onChange={(e) => update("event_date", e.target.value)}
                    required
                  />
                </RequestField>
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              Tanggal yang dipilih masih perlu diperiksa admin. Mengirim
              formulir tidak otomatis mengunci stok atau menjamin kebaya
              tersedia.
            </p>
          </section>

          <section className="border-t border-gray-100 pt-5">
            <h3 className="mb-4 font-bold text-[#1F191E]">
              4. Pengambilan dan Fitting
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <RequestField label="Metode pengambilan" required>
                <select
                  className={inputClass}
                  value={form.fulfillment_method}
                  onChange={(e) =>
                    update("fulfillment_method", e.target.value)
                  }
                  required
                >
                  <option value="PICKUP">Ambil sendiri</option>
                  <option value="DELIVERY">Pengiriman</option>
                </select>
              </RequestField>

              <RequestField label="Metode fitting" required>
                <select
                  className={inputClass}
                  value={form.fitting_method}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((current) => ({
                      ...current,
                      fitting_method: value,
                      fitting_date:
                        value === "OFFLINE" ? current.fitting_date : "",
                      fitting_time:
                        value === "OFFLINE" ? current.fitting_time : "",
                    }));
                  }}
                  required
                >
                  <option value="UNDECIDED">Belum ditentukan</option>
                  <option value="OFFLINE">Fitting langsung</option>
                  <option value="ONLINE">Konsultasi online</option>
                </select>
              </RequestField>

              {form.fitting_method === "OFFLINE" && (
                <>
                  <RequestField label="Tanggal fitting" required>
                    <input
                      className={inputClass}
                      type="date"
                      value={form.fitting_date}
                      min={todayISO()}
                      onChange={(e) =>
                        update("fitting_date", e.target.value)
                      }
                      required
                    />
                  </RequestField>

                  <RequestField label="Jam fitting (opsional)">
                    <input
                      className={inputClass}
                      type="time"
                      value={form.fitting_time}
                      onChange={(e) =>
                        update("fitting_time", e.target.value)
                      }
                    />
                  </RequestField>
                </>
              )}
            </div>

            {form.fitting_method === "ONLINE" && (
              <p className="mt-3 rounded-xl bg-pink-50 p-3 text-xs leading-relaxed text-pink-700">
                Konsultasi online akan dikoordinasikan dengan admin melalui
                WhatsApp. Pengajuan ini tidak membuat panggilan video otomatis.
              </p>
            )}
          </section>

          <section className="border-t border-gray-100 pt-5">
            <h3 className="mb-4 font-bold text-[#1F191E]">
              5. Catatan Tambahan
            </h3>
            <RequestField label="Catatan (opsional)">
              <textarea
                className={inputClass}
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                maxLength={1000}
                placeholder="Tuliskan kebutuhan khusus atau pertanyaan..."
              />
            </RequestField>
          </section>

          <section className="rounded-2xl border border-pink-200 bg-[#FFFAFC] p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-pink-500">
                AURORA SEWA KEBAYA
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#1F191E]">
                Syarat &amp; Ketentuan Pengajuan Sewa
              </h3>
              <p className="mt-1 text-sm text-[#7A6A75]">
                Mohon baca ketentuan berikut sebelum mengirim pengajuan sewa.
              </p>
            </div>

            <div className="max-h-72 space-y-4 overflow-y-auto rounded-xl border border-pink-100 bg-white p-4 text-sm leading-relaxed text-[#4A3F47]">
              <section>
                <h4 className="font-semibold text-[#1F191E]">1. Pengajuan Sewa</h4>
                <p className="mt-1">
                  Formulir ini merupakan pengajuan awal dan bukan bukti bahwa booking telah dikonfirmasi. Admin Aurora akan memeriksa pengajuan dan menghubungi pelanggan untuk konfirmasi lebih lanjut.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">2. Ketersediaan Kebaya</h4>
                <p className="mt-1">
                  Ketersediaan kebaya diperiksa oleh admin berdasarkan jadwal sewa dan kondisi barang, termasuk proses pencucian atau perawatan. Pengajuan tidak otomatis mengunci stok atau menjamin kebaya tersedia.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">3. Data dan Alamat Lengkap</h4>
                <p className="mt-1">
                  Pelanggan wajib mengisi data yang benar dan nomor WhatsApp yang aktif. Alamat lengkap wajib diberikan oleh semua pelanggan, termasuk pelanggan yang mengambil kebaya langsung di butik. Pastikan alamat dapat digunakan untuk keperluan komunikasi dan administrasi penyewaan.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">4. Persyaratan Identitas</h4>
                <p className="mt-1">
                  Pelanggan yang berdomisili di luar Kota Karawang wajib menunjukkan dua identitas kepada admin. Identitas dapat berupa KTP, SIM, dan/atau Kartu Mahasiswa (KTM), dengan total dua dokumen identitas. Admin akan memeriksa identitas secara langsung saat proses konfirmasi atau penyewaan.
                </p>
                <p className="mt-1">
                  Foto atau salinan identitas tidak perlu diunggah melalui formulir pengajuan ini. Tunjukkan identitas langsung kepada admin sesuai arahan yang diberikan.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">5. Harga dan Pembayaran</h4>
                <p className="mt-1">
                  Harga final, uang muka (DP), deposit, batas waktu pembayaran, dan metode pembayaran akan diinformasikan oleh admin sebelum booking dikonfirmasi. Mengirim formulir tidak berarti pembayaran telah dilakukan.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">6. Periode Sewa</h4>
                <p className="mt-1">
                  Pelanggan wajib memastikan tanggal mulai sewa, tanggal selesai sewa, dan tanggal acara sudah benar. Perubahan tanggal harus dikomunikasikan kepada admin dan bergantung pada ketersediaan kebaya.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">7. Pengambilan dan Pengembalian</h4>
                <p className="mt-1">
                  Metode, lokasi, dan jadwal pengambilan atau pengiriman serta pengembalian kebaya mengikuti kesepakatan dengan admin. Pelanggan wajib mengembalikan kebaya dan perlengkapannya sesuai jadwal yang telah disepakati.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">8. Fitting atau Pengepasan</h4>
                <p className="mt-1">
                  Jadwal fitting langsung maupun konsultasi online harus dikonfirmasi terlebih dahulu dengan admin. Pengajuan jadwal fitting belum menjamin jadwal tersebut tersedia.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">9. Pembatalan dan Perubahan</h4>
                <p className="mt-1">
                  Pelanggan yang ingin membatalkan atau mengubah pengajuan wajib menghubungi admin. Ketentuan pembatalan, pengembalian pembayaran, dan perubahan jadwal akan mengikuti kebijakan Aurora yang dijelaskan sebelum transaksi disepakati.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">10. Kerusakan, Kehilangan, dan Keterlambatan</h4>
                <p className="mt-1">
                  Pelanggan wajib menjaga kebaya dan perlengkapannya selama masa sewa. Ketentuan biaya keterlambatan, kerusakan, atau kehilangan akan dijelaskan oleh admin sebelum booking dikonfirmasi.
                </p>
              </section>
              <section>
                <h4 className="font-semibold text-[#1F191E]">11. Persetujuan</h4>
                <p className="mt-1">
                  Dengan mencentang persetujuan, pelanggan menyatakan telah membaca dan memahami syarat pengajuan sewa Aurora serta bersedia mengikuti proses konfirmasi dari admin. Booking baru dianggap dikonfirmasi setelah mendapat persetujuan admin dan memenuhi ketentuan penyewaan.
                </p>
              </section>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-pink-100 p-3 text-sm leading-relaxed text-[#4A3F47]">
              <input
                type="checkbox"
                name="terms_accepted"
                checked={form.terms_accepted}
                onChange={(e) => update("terms_accepted", e.target.checked)}
                required
                className="mt-1 h-4 w-4 shrink-0 accent-pink-500"
              />
              <span>
                Saya telah membaca, memahami, dan menyetujui Syarat &amp; Ketentuan Pengajuan Sewa Aurora.
                <span className="ml-1 font-semibold text-pink-600">(Wajib dicentang)</span>
              </span>
            </label>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E83E8C] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#D62B78] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <LoaderCircle size={17} className="animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <ClipboardList size={17} />
                  Kirim Pengajuan
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Katalog publik Aurora — tidak memerlukan login.
 * Pengajuan sewa tidak otomatis membuat booking atau mengunci stok.
 */
export default function PublicCatalog() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(publicCatalog, []);

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [availFilter, setAvailFilter] = useState("");
  const [range, setRange] = useState({
    start: todayISO(),
    end: addDays(todayISO(), 2),
  });
  const [avail, setAvail] = useState({});
  const [checking, setChecking] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [requestProduct, setRequestProduct] = useState(null);

  const products = useMemo(() => data?.products || [], [data]);
  const categories = useMemo(() => data?.categories || [], [data]);
  const rangeValid =
    range.start && range.end && range.end >= range.start;

  const runAvailability = useCallback(async () => {
    if (!rangeValid) return;

    setChecking(true);
    try {
      const rows = await catalogAvailability(range.start, range.end);
      const map = {};
      (rows || []).forEach((row) => {
        map[row.product_id] = row;
      });
      setAvail(map);
    } catch (e) {
      toast.error(e.message || "Gagal cek ketersediaan");
    } finally {
      setChecking(false);
    }
  }, [range.start, range.end, rangeValid]);

  useEffect(() => {
    runAvailability();
  }, [runAvailability]);

  const checkOne = async (product) => {
    if (!rangeValid) {
      toast.error("Tanggal selesai harus setelah tanggal mulai");
      return;
    }

    setCheckingId(product.id);
    try {
      const result = await checkAvailability(
        product.id,
        range.start,
        range.end
      );
      setAvail((current) => ({
        ...current,
        [product.id]: { product_id: product.id, ...result },
      }));

      const message = availabilityText(result);
      if (Number(result.available) > 0) {
        toast.success(`${product.name}: ${message}`);
      } else {
        toast.error(`${product.name}: ${message}`);
      }
    } catch (e) {
      toast.error(e.message || "Gagal cek ketersediaan");
    } finally {
      setCheckingId(null);
    }
  };

  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const q = search.toLowerCase();
        const okSearch =
          !q ||
          product.name.toLowerCase().includes(q) ||
          (product.product_code || "").toLowerCase().includes(q) ||
          (product.color || "").toLowerCase().includes(q);

        const okCategory =
          !cat || product.category_id === cat;

        const availability = avail[product.id];
        const okAvailability =
          !availFilter ||
          (availability &&
            (availFilter === "available"
              ? Number(availability.available) > 0
              : Number(availability.available) <= 0));

        return okSearch && okCategory && okAvailability;
      }),
    [products, search, cat, availFilter, avail]
  );

  const availableCount = useMemo(
    () =>
      products.filter(
        (product) => Number(avail[product.id]?.available || 0) > 0
      ).length,
    [products, avail]
  );

  const openRequest = (product) => {
    setRequestProduct(product);
  };

  return (
    <div
      className="min-h-screen bg-[#FAF7F8]"
      data-testid="public-catalog-page"
    >
      <header className="sticky top-0 z-30 border-b border-[#F8D7E3] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E83E8C] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p
              className="font-bold leading-tight text-[#1F191E]"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.25rem",
              }}
            >
              AURORA
            </p>
            <p className="-mt-0.5 text-[10px] tracking-[0.2em] text-[#7A6A75]">
              SEWA KEBAYA
            </p>
          </div>
          <div className="ml-auto">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-[#F8D7E3] bg-[#FFF5F8] px-3.5 py-2 text-sm font-medium text-[#E83E8C] hover:bg-[#FCE4EC]"
                data-testid="public-dashboard-link"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-[#E83E8C] px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#D62B78]"
                data-testid="public-login-link"
              >
                <LogIn className="h-4 w-4" />
                Masuk Staff
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[#E83E8C] to-[#F06AA5] p-6 text-white shadow-lg sm:p-8">
          <h1
            className="text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Cek Ketersediaan Kebaya
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-white/90">
            Pilih tanggal sewa untuk melihat kebaya yang tersedia.
            Ketersediaan dihitung dari jadwal booking dan rental terkini.
          </p>

          <div className="mt-5 grid items-end gap-3 rounded-xl bg-white/95 p-3 text-[#1F191E] sm:grid-cols-4 sm:p-4">
            <Field label="Tanggal Mulai Sewa">
              <TextInput
                type="date"
                value={range.start}
                min={todayISO()}
                onChange={(e) =>
                  setRange((current) => ({
                    ...current,
                    start: e.target.value,
                    end:
                      current.end < e.target.value
                        ? e.target.value
                        : current.end,
                  }))
                }
                data-testid="public-start-date"
              />
            </Field>
            <Field label="Tanggal Selesai Sewa">
              <TextInput
                type="date"
                value={range.end}
                min={range.start}
                onChange={(e) =>
                  setRange((current) => ({
                    ...current,
                    end: e.target.value,
                  }))
                }
                data-testid="public-end-date"
              />
            </Field>
            <Btn
              onClick={runAvailability}
              loading={checking}
              className="py-2.5"
              data-testid="public-check-availability"
            >
              <CalendarSearch className="h-4 w-4" />
              Cek Ketersediaan
            </Btn>
            <p
              className="inline-flex items-center gap-1.5 text-xs text-[#7A6A75] sm:pb-2.5"
              data-testid="public-availability-summary"
            >
              {rangeValid ? (
                <>
                  {formatDateShort(range.start)} – {formatDateShort(range.end)}:
                  <b className="text-[#047857]">{availableCount}</b> dari{" "}
                  {products.length} produk tersedia
                </>
              ) : (
                <span className="text-[#B91C1C]">
                  Tanggal selesai harus setelah tanggal mulai
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#F8D7E3] bg-white p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama / kode / warna…"
            testid="public-search"
          />
          <NativeSelect
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            placeholder="Semua Kategori"
            options={categories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
            className="sm:w-48"
            data-testid="public-category-filter"
          />
          <NativeSelect
            value={availFilter}
            onChange={(e) => setAvailFilter(e.target.value)}
            placeholder="Semua Status"
            options={[
              { value: "available", label: "Hanya yang tersedia" },
              { value: "unavailable", label: "Tidak tersedia" },
            ]}
            className="sm:w-52"
            data-testid="public-availability-filter"
          />
          <p className="inline-flex items-center gap-1.5 text-xs text-[#7A6A75] sm:ml-auto">
            <ShieldCheck className="h-3.5 w-3.5 text-[#047857]" />
            Identitas penyewa lain tidak ditampilkan
          </p>
        </div>

        <div className="mt-6">
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Tidak ada kebaya yang cocok"
              subtitle="Coba ubah tanggal, kategori, atau kata kunci pencarian."
            />
          ) : (
            <div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="public-product-grid"
            >
              {filtered.map((product) => (
                <div key={product.id} className="flex min-w-0 flex-col">
                  <CatalogCard
                    product={product}
                    avail={avail[product.id]}
                    checking={checkingId === product.id}
                    publicMode
                    onCheck={checkOne}
                    onSchedule={(selectedProduct) =>
                      setSchedule(selectedProduct)
                    }
                  />

                  <button
                    type="button"
                    onClick={() => openRequest(product)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E83E8C] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#D62B78] focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2"
                    data-testid={`request-rental-${product.id}`}
                  >
                    <ClipboardList className="h-4 w-4" />
                    Ajukan Sewa
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="mt-10 text-center text-xs text-[#7A6A75]">
          © {new Date().getFullYear()} Aurora Sewa Kebaya
        </footer>
      </main>

      <ScheduleModal
        product={schedule}
        open={!!schedule}
        onClose={() => setSchedule(null)}
        startDate={rangeValid ? range.start : null}
        endDate={rangeValid ? range.end : null}
      />

      {requestProduct && (
        <RequestForm
          key={requestProduct.id}
          product={requestProduct}
          initialStart={rangeValid ? range.start : todayISO()}
          initialEnd={rangeValid ? range.end : addDays(todayISO(), 2)}
          onClose={() => setRequestProduct(null)}
        />
      )}
    </div>
  );
}
