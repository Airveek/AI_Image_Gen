import Link from "next/link";
import { ArrowRight } from "lucide-react";

type CtaButtonProps = {
  href?: string;
  children: string;
  variant?: "primary" | "secondary" | "inverse";
  className?: string;
  showArrow?: boolean;
  size?: "default" | "hero";
};

export function CtaButton({ href = "#pricing", children, variant = "primary", className = "", showArrow = true, size = "default" }: CtaButtonProps) {
  const styles = {
    primary: "cta-primary bg-primary shadow-[0_16px_40px_rgba(var(--theme-shadow))] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_20px_48px_rgba(var(--theme-shadow))]",
    secondary: "border border-border bg-surface text-foreground shadow-sm hover:border-primary/55 hover:bg-surface-muted",
    inverse: "border border-white/75 bg-white text-[#0d120d] shadow-[0_16px_40px_rgba(0,0,0,0.16)] hover:-translate-y-0.5 hover:bg-[#f5f7f3]",
  }[variant];
  const sizing = size === "hero"
    ? "min-h-10 px-5 py-2 text-sm sm:min-h-14 sm:px-7 sm:py-3 sm:text-base"
    : "min-h-12 px-6 py-3 text-sm sm:px-7 sm:text-base";

  return (
    <Link
      className={`group inline-flex items-center justify-center gap-2 rounded-full font-bold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus ${sizing} ${styles} ${className}`}
      href={href}
    >
      {children}
      {showArrow ? <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" /> : null}
    </Link>
  );
}
