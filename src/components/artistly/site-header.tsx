import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="flex justify-center px-5 pb-5 pt-[50px]">
      <Image
        src="/images/artistly/logo.png"
        alt="Artistly 6.0"
        width={236}
        height={52}
        className="w-[236px]"
        priority
      />
    </header>
  );
}
