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
        variant === "default" && "border-border bg-surface-muted text-muted-foreground",
        variant === "success" && "border-success/30 bg-success-soft text-success",
        variant === "warning" && "border-warning/30 bg-warning-soft text-warning",
        variant === "danger" && "border-danger/30 bg-danger-soft text-danger",
        className,
      )}
      {...props}
    />
  );
}
