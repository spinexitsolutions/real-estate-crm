import { cn } from "@/lib/utils";
import { optionOf, type Option } from "@/lib/constants";

export function Badge({ className, children, dot }: { className?: string; children: React.ReactNode; dot?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        className ?? "bg-slate-50 text-slate-700 ring-slate-500/20",
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export function OptionBadge({ list, value, withDot }: { list: Option[]; value: string | null | undefined; withDot?: boolean }) {
  const o = optionOf(list, value);
  if (!o) return <Badge>{value ?? "-"}</Badge>;
  return (
    <Badge className={o.color} dot={withDot ? o.dot : undefined}>
      {o.label}
    </Badge>
  );
}
