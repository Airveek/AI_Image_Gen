import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="artistly-header">
      <Link href="/" aria-label="Artistly home">
        <Image
          src="/images/artistly/logo.png"
          alt="Artistly 6.0"
          width={236}
          height={52}
          className="artistly-logo"
          priority
        />
      </Link>
    </header>
  );
}
