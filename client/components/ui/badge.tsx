import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "info";

const badgeVariantClassName: Record<BadgeVariant, string> = {
  default: "border-orange-500/25 bg-orange-500/10 text-orange-200",
  secondary: "border-white/10 bg-white/5 text-zinc-300",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  destructive: "border-rose-500/25 bg-rose-500/10 text-rose-200",
  info: "border-sky-500/25 bg-sky-500/10 text-sky-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase",
        badgeVariantClassName[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
export type { BadgeVariant };