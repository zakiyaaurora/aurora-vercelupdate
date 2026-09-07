import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../lib/constants";

export default function ProtectedRoute({ children, navKey }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FAF7F8]">
        <div className="flex flex-col items-center gap-3" data-testid="auth-loading">
          <div className="h-10 w-10 rounded-full border-2 border-[#E83E8C] border-t-transparent animate-spin" />
          <p className="text-sm text-[#7A6A75]">Memuat…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (navKey && role && !canAccess(role, navKey)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
