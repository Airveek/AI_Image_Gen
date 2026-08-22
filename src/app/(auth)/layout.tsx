import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="brand-glow min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <Link href="/" aria-label="Airveek home">
          <Image
            src="/images/airveek/logo.png"
            alt="Airveek"
            width={1881}
            height={358}
            className="w-[180px] sm:w-[220px]"
            priority
          />
        </Link>
        <div className="mt-10 w-full">{children}</div>
      </div>
    </main>
  );
}
