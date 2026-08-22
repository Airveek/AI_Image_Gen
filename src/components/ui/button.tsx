import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "default" | "icon";
};

export function Button({ className, variant = "secondary", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-neon",
        variant === "primary" && "border-brand-neon bg-brand-neon text-brand-black hover:bg-brand-soft",
        variant === "secondary" && "border-white/10 bg-white/[0.06] text-brand-white hover:border-brand-neon/50 hover:bg-brand-neon/10",
        variant === "ghost" && "border-transparent bg-transparent text-muted hover:bg-white/[0.06] hover:text-brand-white",
        variant === "danger" && "border-red-400/30 bg-red-500/10 text-red-200 hover:border-red-400/60 hover:bg-red-500/20",
        size === "icon" && "w-11 px-0",
        className,
      )}
      {...props}
    />
  );
}
