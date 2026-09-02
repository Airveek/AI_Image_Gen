import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  size?: "default" | "display";
  titleId?: string;
  children?: ReactNode;
};

export function SectionHeading({ eyebrow, title, description, align = "center", size = "default", titleId, children }: SectionHeadingProps) {
  const alignment = align === "left" ? "text-left" : "text-center";
  const titleSize = size === "display"
    ? "text-[2.5rem] font-medium leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-[4rem]"
    : "text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl";

  return (
    <div className={`${size === "display" ? "max-w-5xl" : "max-w-3xl"} ${alignment} ${align === "center" ? "mx-auto" : ""}`}>
      {eyebrow ? <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-primary">{eyebrow}</p> : null}
      <h2 id={titleId} className={`text-balance font-display text-foreground ${titleSize}`}>{title}</h2>
      {description ? <p className={`mx-auto mt-5 text-base leading-7 text-muted-foreground sm:text-lg ${size === "display" ? "max-w-3xl" : ""}`}>{description}</p> : null}
      {children}
    </div>
  );
}
