import { avatarColor, cn, initials } from "@/lib/utils";

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-7 text-[11px]",
    md: "size-9 text-xs",
    lg: "size-11 text-sm",
    xl: "size-16 text-lg",
  };
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", sizes[size], avatarColor(name), className)}
    >
      {initials(name) || "?"}
    </span>
  );
}
