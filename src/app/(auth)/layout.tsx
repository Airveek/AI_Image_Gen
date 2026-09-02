import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { noIndexMetadata } from "@/lib/seo/site";
import { AirveekLogo } from "@/components/airveek/airveek-logo";

export const metadata: Metadata = {
  ...noIndexMetadata,
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="brand-glow min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <div className="flex w-full items-center justify-center">
          <Link href="/" aria-label="Airveek home">
            <AirveekLogo className="w-[180px] sm:w-[220px]" priority />
          </Link>
        </div>
        <div className="mt-10 w-full">{children}</div>
      </div>
    </main>
  );
}
