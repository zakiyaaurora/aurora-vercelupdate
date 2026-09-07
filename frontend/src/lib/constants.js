import {
  LayoutDashboard, Shirt, Calendar, Clock, ShoppingBag, Users, Boxes,
  CreditCard, FileText, BarChart3, UserCog, Settings,
} from "lucide-react";

export const ROLES = ["OWNER", "ADMIN", "KASIR", "STAFF"];

export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ROLES },
  { key: "katalog", label: "Katalog Kebaya", path: "/katalog", icon: Shirt, roles: ROLES },
  { key: "booking", label: "Booking & Jadwal", path: "/booking", icon: Calendar, roles: ROLES },
  { key: "rental", label: "Manajemen Rental", path: "/rental", icon: Clock, roles: ROLES },
  { key: "pos", label: "POS / Kasir", path: "/pos", icon: ShoppingBag, roles: ["OWNER", "ADMIN", "KASIR"] },
  { key: "pelanggan", label: "Data Pelanggan", path: "/pelanggan", icon: Users, roles: ["OWNER", "ADMIN", "KASIR"] },
  { key: "stok", label: "Stok & Inventaris", path: "/stok", icon: Boxes, roles: ["OWNER", "ADMIN", "STAFF"] },
  { key: "pembayaran", label: "Pembayaran", path: "/pembayaran", icon: CreditCard, roles: ["OWNER", "ADMIN", "KASIR"] },
  { key: "invoice", label: "Invoice", path: "/invoice", icon: FileText, roles: ["OWNER", "ADMIN", "KASIR"] },
  { key: "laporan", label: "Laporan", path: "/laporan", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
  { key: "pengguna", label: "Pengguna", path: "/pengguna", icon: UserCog, roles: ["OWNER"] },
  { key: "settings", label: "Pengaturan", path: "/settings", icon: Settings, roles: ["OWNER", "ADMIN"] },
];

export const canAccess = (role, key) => {
  const item = NAV_ITEMS.find((n) => n.key === key);
  if (!item) return true;
  return item.roles.includes(role);
};

export const INVENTORY_STATUS = ["AVAILABLE", "BOOKED", "RENTED", "MAINTENANCE", "DAMAGED", "LOST", "RESERVED"];
export const INVENTORY_CONDITION = ["GOOD", "MINOR_DAMAGE", "DAMAGED", "NEEDS_REPAIR"];
export const BOOKING_STATUS = ["DRAFT", "PENDING", "CONFIRMED", "READY", "PAID", "RENTED", "RETURNED", "COMPLETED", "CANCELLED"];
export const RENTAL_STATUS = ["READY", "BOOKED", "OUT", "ACTIVE", "OVERDUE", "LATE", "RETURNED", "CANCELLED"];
export const INVOICE_STATUS = ["UNPAID", "PARTIAL", "PAID", "CANCELLED"];
export const PAYMENT_METHODS = ["CASH", "TRANSFER", "QRIS", "DEBIT", "CREDIT", "OTHER"];
export const PAYMENT_TYPES = ["DEPOSIT", "DP", "PARTIAL", "FULL", "REFUND", "PENALTY"];
export const STOCK_MOVEMENT_TYPES = ["STOCK_IN", "RENTAL_OUT", "RENTAL_RETURN", "ADJUSTMENT", "DAMAGE", "MAINTENANCE", "LOST"];

export const STATUS_STYLES = {
  // inventory
  AVAILABLE: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  BOOKED: "bg-[#F3E8FF] text-[#6D28D9] border-[#DDD6FE]",
  RESERVED: "bg-[#F3E8FF] text-[#6D28D9] border-[#DDD6FE]",
  RENTED: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
  MAINTENANCE: "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]",
  DAMAGED: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  LOST: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  // booking/rental
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  PENDING: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
  CONFIRMED: "bg-[#F3E8FF] text-[#6D28D9] border-[#DDD6FE]",
  READY: "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]",
  PAID: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  OUT: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
  ACTIVE: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
  OVERDUE: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  LATE: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  RETURNED: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  COMPLETED: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
  // invoice
  UNPAID: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  PARTIAL: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
  // condition
  GOOD: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  MINOR_DAMAGE: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
  NEEDS_REPAIR: "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]",
  // user
  ACTIVE_USER: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
  INACTIVE: "bg-gray-100 text-gray-500 border-gray-200",
};
