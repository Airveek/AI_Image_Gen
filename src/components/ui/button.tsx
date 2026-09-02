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
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        variant === "primary" && "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover",
        variant === "secondary" && "border-border bg-surface text-foreground shadow-sm hover:border-primary/50 hover:bg-surface-muted",
        variant === "ghost" && "border-transparent bg-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
        variant === "danger" && "border-danger/30 bg-danger-soft text-danger hover:border-danger/60",
        size === "icon" && "w-11 px-0",
        className,
      )}
      {...props}
    />
  );
}
