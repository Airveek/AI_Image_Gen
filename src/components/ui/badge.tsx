import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        variant === "default" && "border-white/10 bg-white/[0.06] text-muted",
        variant === "success" && "border-brand-neon/30 bg-brand-neon/10 text-brand-soft",
        variant === "warning" && "border-yellow-300/30 bg-yellow-300/10 text-yellow-100",
        variant === "danger" && "border-red-400/30 bg-red-500/10 text-red-200",
        className,
      )}
      {...props}
    />
  );
}
