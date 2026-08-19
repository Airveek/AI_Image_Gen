import Link from "next/link";
import { ArrowRight } from "lucide-react";

type CtaButtonProps = {
  href?: string;
  children: string;
  variant?: "primary" | "secondary";
  className?: string;
};

export function CtaButton({ href = "#pricing", children, variant = "primary", className = "" }: CtaButtonProps) {
  const styles = variant === "primary"
    ? "bg-gradient-to-r from-fuchsia-500 via-rose-500 to-amber-400 text-white shadow-[0_16px_40px_rgba(236,72,153,0.28)] hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(236,72,153,0.38)]"
    : "border border-white/20 bg-white/[0.06] text-white hover:border-cyan-300/60 hover:bg-white/[0.1]";

  return (
    <Link
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-300 sm:px-7 sm:text-base ${styles} ${className}`}
      href={href}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}
