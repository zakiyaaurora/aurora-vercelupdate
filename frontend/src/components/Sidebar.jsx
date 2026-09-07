import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Sparkles, X } from "lucide-react";

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const { role } = useAuth();
  const items = NAV_ITEMS.filter((n) => !role || n.roles.includes(role));

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onCloseMobile} data-testid="sidebar-overlay" />
      )}
      <aside
        data-testid="app-sidebar"
        className={cn(
          "fixed lg:sticky top-0 z-50 h-screen shrink-0 bg-white border-r border-[#F8D7E3] flex flex-col transition-all duration-300",
          collapsed ? "lg:w-20" : "lg:w-64",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[#FCE4EC]">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[#E83E8C] grid place-items-center text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-[#1F191E] leading-tight truncate" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.15rem" }}>
                AURORA
              </p>
              <p className="text-[10px] tracking-[0.2em] text-[#E83E8C] font-semibold">SEWA KEBAYA</p>
            </div>
          )}
          <button onClick={onCloseMobile} className="ml-auto lg:hidden text-[#7A6A75]" data-testid="sidebar-close-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                onClick={onCloseMobile}
                data-testid={`nav-${item.key}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-[#E83E8C] text-white shadow-sm"
                      : "text-[#4A3F47] hover:bg-[#FFF5F8] hover:text-[#E83E8C]"
                  )
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="p-4 border-t border-[#FCE4EC]">
            <p className="text-[10px] text-[#B79BAA] text-center">© 2026 Aurora Sewa Kebaya</p>
          </div>
        )}
      </aside>
    </>
  );
}
