import { cn } from "@/lib/utils";
import { STATUS_STYLES } from "@/lib/constants";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function StatusBadge({ status, className }) {
  const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", style, className)}
    >
      {status}
    </span>
  );
}

export function StatCard({ label, value, icon: Icon, tone = "pink", sub, testid }) {
  const tones = {
    pink: "bg-[#FFF5F8] text-[#E83E8C]",
    green: "bg-[#ECFDF5] text-[#047857]",
    amber: "bg-[#FEF3C7] text-[#B45309]",
    red: "bg-[#FEF2F2] text-[#B91C1C]",
    purple: "bg-[#F3E8FF] text-[#6D28D9]",
    blue: "bg-[#E0F2FE] text-[#0369A1]",
  };
  return (
    <div
      data-testid={testid}
      className="bg-white border border-[#F8D7E3] rounded-xl p-5 shadow-[0_2px_12px_rgba(232,62,140,0.04)] transition-all hover:shadow-[0_4px_20px_rgba(232,62,140,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#7A6A75] uppercase tracking-wide truncate">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#1F191E] tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-[#7A6A75]">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("h-11 w-11 shrink-0 rounded-xl grid place-items-center", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionCard({ title, action, children, className, testid }) {
  return (
    <div data-testid={testid} className={cn("bg-white border border-[#F8D7E3] rounded-xl shadow-[0_2px_12px_rgba(232,62,140,0.04)]", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#FCE4EC]">
          {title && <h3 className="text-base font-semibold text-[#1F191E]">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F191E]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#7A6A75]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ label = "Memuat data…" }) {
  return (
    <div className="grid place-items-center py-20 text-[#7A6A75]" data-testid="loading-state">
      <Loader2 className="h-8 w-8 animate-spin text-[#E83E8C]" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title = "Belum ada data", subtitle, action }) {
  return (
    <div className="grid place-items-center py-16 text-center" data-testid="empty-state">
      <div className="h-14 w-14 rounded-2xl bg-[#FFF5F8] grid place-items-center text-[#E83E8C]">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-[#1F191E]">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-[#7A6A75] max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="grid place-items-center py-16 text-center" data-testid="error-state">
      <div className="h-14 w-14 rounded-2xl bg-[#FEF2F2] grid place-items-center text-[#B91C1C]">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-[#1F191E]">Terjadi kesalahan</p>
      <p className="mt-1 text-sm text-[#7A6A75] max-w-md">{String(error?.message || error || "Gagal memuat data")}</p>
      {onRetry && (
        <button onClick={onRetry} data-testid="error-retry-btn" className="mt-4 text-sm font-medium text-[#E83E8C] hover:underline">
          Coba lagi
        </button>
      )}
    </div>
  );
}
