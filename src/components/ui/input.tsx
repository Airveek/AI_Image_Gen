import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:bg-disabled disabled:text-disabled-foreground",
        "focus-visible:border-focus focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
