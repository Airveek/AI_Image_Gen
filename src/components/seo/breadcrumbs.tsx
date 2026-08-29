import Link from "next/link";

type Breadcrumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm text-[#a4b19e]">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li className="flex items-center gap-2" key={`${item.label}-${index}`}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? <Link className="transition hover:text-[#83ff00]" href={item.href}>{item.label}</Link> : <span aria-current="page" className="text-[#d9ffb8]">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

