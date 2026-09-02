import Image from "next/image";

type AirveekLogoProps = {
  className?: string;
  priority?: boolean;
  tone?: "theme" | "light" | "ink";
};

export function AirveekLogo({ className = "h-auto w-[200px]", priority = false, tone = "theme" }: AirveekLogoProps) {
  if (tone !== "theme") {
    return (
      <span className="relative inline-flex shrink-0" aria-label="Airveek">
        <Image
          src={tone === "light" ? "/images/airveek/logo.png" : "/images/airveek/logo-ink.png"}
          alt="Airveek"
          width={1881}
          height={358}
          className={className}
          priority={priority}
        />
      </span>
    );
  }

  return (
    <span className="relative inline-flex shrink-0" aria-label="Airveek">
      <Image
        src="/images/airveek/logo-ink.png"
        alt="Airveek"
        width={1881}
        height={358}
        className={`theme-logo-light ${className}`}
        priority={priority}
      />
      <Image
        src="/images/airveek/logo.png"
        alt=""
        width={1881}
        height={358}
        className={`theme-logo-dark ${className}`}
        priority={priority}
        aria-hidden="true"
      />
    </span>
  );
}
