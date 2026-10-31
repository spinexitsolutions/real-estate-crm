import { cn } from "@/lib/utils";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
export type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-xs focus-visible:ring-brand-500/30",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs focus-visible:ring-slate-400/20",
  outline: "bg-transparent text-brand-700 border border-brand-200 hover:bg-brand-50 focus-visible:ring-brand-500/20",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/20",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-xs focus-visible:ring-rose-500/30",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs focus-visible:ring-emerald-500/30",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

