import Link from "next/link";

type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-600">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 ? <span className="text-zinc-400">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-zinc-900 underline">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-zinc-900">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
