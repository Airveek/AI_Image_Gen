import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  titleId?: string;
  children?: ReactNode;
};

export function SectionHeading({ eyebrow, title, description, align = "center", titleId, children }: SectionHeadingProps) {
  const alignment = align === "left" ? "text-left" : "text-center";

  return (
    <div className={`max-w-3xl ${alignment} ${align === "center" ? "mx-auto" : ""}`}>
      {eyebrow ? <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#83ff00]">{eyebrow}</p> : null}
      <h2 id={titleId} className="font-display text-3xl font-extrabold leading-tight text-[#fdfdfd] sm:text-4xl lg:text-5xl">{title}</h2>
      {description ? <p className="mt-5 text-base leading-7 text-[#a4b19e] sm:text-lg">{description}</p> : null}
      {children}
    </div>
  );
}
