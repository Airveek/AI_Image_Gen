import Link from "next/link";

type Breadcrumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li className="flex items-center gap-2" key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? <Link className="transition hover:text-primary" href={item.href}>{item.label}</Link> : <span aria-current="page" className="text-foreground">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
