import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const baseInput =
  "w-full rounded-lg border border-[#F0C4D6] bg-white px-3.5 py-2 text-sm text-[#1F191E] outline-none transition-all focus:border-[#E83E8C] focus:ring-2 focus:ring-[#FCE4EC] disabled:bg-[#FAF7F8]";

export function Field({ label, required, children, className }) {
  return (
    <div className={className}>
      {label && (
        <label className="text-sm font-medium text-[#4A3F47]">
          {label} {required && <span className="text-[#E83E8C]">*</span>}
        </label>
      )}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function TextInput({ className, ...props }) {
  return <input className={cn(baseInput, className)} {...props} />;
}

export function TextArea({ className, ...props }) {
  return <textarea className={cn(baseInput, "min-h-[80px]", className)} {...props} />;
}

export function NativeSelect({ options = [], placeholder, className, ...props }) {
  return (
    <select className={cn(baseInput, "appearance-none", className)} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>{o}</option>
        ) : (
          <option key={o.value} value={o.value}>{o.label}</option>
        )
      )}
    </select>
  );
}

export function Btn({ variant = "primary", className, loading, children, ...props }) {
  const variants = {
    primary: "bg-[#E83E8C] hover:bg-[#D62B78] text-white shadow-sm",
    secondary: "bg-[#FFF5F8] hover:bg-[#FCE4EC] text-[#E83E8C] border border-[#F8D7E3]",
    outline: "border border-[#E2D5DD] hover:bg-[#FAF7F8] text-[#1F191E]",
    danger: "bg-[#EF4444] hover:bg-[#DC2626] text-white",
    ghost: "text-[#4A3F47] hover:bg-[#FFF5F8]",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60",
        variants[variant], className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn("bg-white border-[#F8D7E3] rounded-2xl p-0 gap-0 overflow-hidden", sizes[size])}>
        <DialogHeader className="px-6 py-4 border-b border-[#FCE4EC]">
          <DialogTitle className="text-lg font-semibold text-[#1F191E]">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <DialogFooter className="px-6 py-4 border-t border-[#FCE4EC] bg-[#FEFCFD]">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export function Th({ children, className }) {
  return <th className={cn("bg-[#FFF5F8] text-[#1F191E] font-semibold p-3 text-left text-xs uppercase tracking-wide", className)}>{children}</th>;
}
export function Td({ children, className }) {
  return <td className={cn("p-3 border-b border-[#FCE4EC] text-sm text-[#4A3F47]", className)}>{children}</td>;
}
export function Table({ children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#F8D7E3]">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Cari…", testid }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testid}
      className="w-full sm:w-64 rounded-lg border border-[#F0C4D6] bg-white px-3.5 py-2 text-sm outline-none focus:border-[#E83E8C] focus:ring-2 focus:ring-[#FCE4EC]"
    />
  );
}
