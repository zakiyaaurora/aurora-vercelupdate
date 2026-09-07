import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Menu, PanelLeftClose, PanelLeft, LogOut, Bell, User } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header({ onToggleCollapse, onToggleMobile }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    await signOut();
    navigate("/login", { replace: true });
  };

  const initials = (profile?.name || profile?.email || "U").slice(0, 2).toUpperCase();

  return (
    <header className="h-16 sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#F8D7E3] flex items-center gap-3 px-4 sm:px-6">
      <button onClick={onToggleMobile} className="lg:hidden text-[#4A3F47]" data-testid="header-mobile-toggle">
        <Menu className="h-5 w-5" />
      </button>
      <button onClick={onToggleCollapse} className="hidden lg:inline-flex text-[#7A6A75] hover:text-[#E83E8C]" data-testid="header-collapse-toggle">
        <PanelLeft className="h-5 w-5" />
      </button>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <button className="relative h-9 w-9 rounded-lg grid place-items-center text-[#7A6A75] hover:bg-[#FFF5F8] hover:text-[#E83E8C]" data-testid="header-notifications">
          <Bell className="h-[18px] w-[18px]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg pl-1 pr-2 py-1 hover:bg-[#FFF5F8] transition-colors" data-testid="header-user-menu">
              <div className="h-8 w-8 rounded-full bg-[#E83E8C] text-white grid place-items-center text-xs font-semibold">
                {initials}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-sm font-semibold text-[#1F191E] max-w-[140px] truncate">{profile?.name || "Pengguna"}</p>
                <p className="text-[11px] text-[#E83E8C] font-medium">{profile?.role || "-"}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white">
            <DropdownMenuLabel>
              <p className="font-semibold text-[#1F191E]">{profile?.name}</p>
              <p className="text-xs text-[#7A6A75] font-normal">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs">
              <User className="h-4 w-4 mr-2" /> Role: {profile?.role}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={busy} data-testid="logout-btn" className="text-[#B91C1C] focus:text-[#B91C1C] focus:bg-[#FEF2F2]">
              <LogOut className="h-4 w-4 mr-2" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
