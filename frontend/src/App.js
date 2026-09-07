import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/routing/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import SetupRequired from "@/pages/SetupRequired";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Katalog from "@/pages/Katalog";
import Pelanggan from "@/pages/Pelanggan";
import CustomerDetail from "@/pages/CustomerDetail";
import Booking from "@/pages/Booking";
import Rental from "@/pages/Rental";
import POS from "@/pages/POS";
import Stok from "@/pages/Stok";
import Pembayaran from "@/pages/Pembayaran";
import Invoice from "@/pages/Invoice";
import Laporan from "@/pages/Laporan";
import Pengguna from "@/pages/Pengguna";
import Settings from "@/pages/Settings";
import PublicCatalog from "@/pages/PublicCatalog";

const page = (navKey, element) => (
  <ProtectedRoute navKey={navKey}>{element}</ProtectedRoute>
);

function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="App">
        <SetupRequired />
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Katalog publik: dapat diakses tanpa login (identitas penyewa disamarkan oleh server) */}
            <Route path="/sewa" element={<PublicCatalog />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/katalog" element={<Katalog />} />
              <Route path="/pelanggan" element={page("pelanggan", <Pelanggan />)} />
              <Route path="/pelanggan/:id" element={page("pelanggan", <CustomerDetail />)} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/rental" element={<Rental />} />
              <Route path="/pos" element={page("pos", <POS />)} />
              <Route path="/stok" element={page("stok", <Stok />)} />
              <Route path="/pembayaran" element={page("pembayaran", <Pembayaran />)} />
              <Route path="/invoice" element={page("invoice", <Invoice />)} />
              <Route path="/laporan" element={page("laporan", <Laporan />)} />
              <Route path="/pengguna" element={page("pengguna", <Pengguna />)} />
              <Route path="/settings" element={page("settings", <Settings />)} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
