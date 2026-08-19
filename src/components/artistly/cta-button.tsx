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
    ? "cta-primary bg-gradient-to-r from-[#2ac414] via-[#83ff00] to-[#2ac414] shadow-[0_16px_40px_rgba(131,255,0,0.2)] hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(131,255,0,0.3)]"
    : "border border-[#83ff00]/30 bg-white/[0.04] text-[#fdfdfd] hover:border-[#83ff00]/70 hover:bg-[#83ff00]/10";

  return (
    <Link
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#83ff00] sm:px-7 sm:text-base ${styles} ${className}`}
      href={href}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}
