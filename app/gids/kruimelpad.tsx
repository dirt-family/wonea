import Link from "next/link";

/** Zichtbaar kruimelpad voor alle gids-pagina's; de laatste stap is geen link. */
export function Kruimelpad({ items }: { items: { naam: string; href?: string }[] }) {
  return (
    <nav aria-label="Kruimelpad" className="text-sm text-gedempt">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.naam} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-merk">
                {item.naam}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-inkt-zacht">
                {item.naam}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
