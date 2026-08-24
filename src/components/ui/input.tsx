import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-xl border border-white/10 bg-brand-black px-3 text-sm text-brand-white placeholder:text-brand-gray",
        "focus-visible:border-brand-neon/60 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
