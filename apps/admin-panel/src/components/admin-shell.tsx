import Link from "next/link";
import type { PropsWithChildren } from "react";

const menu = [
  { href: "/", label: "Overview" },
  { href: "/workers", label: "Workers" },
  { href: "/jobs", label: "Jobs" },
  { href: "/stats", label: "Stats" },
  { href: "/shuttle", label: "Shuttle" }
];

export function AdminShell({
  title,
  description,
  children
}: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin Panel</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {menu.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="admin-grid">{children}</main>
    </div>
  );
}

export function AdminCard({
  title,
  body,
  badge
}: {
  title: string;
  body: string;
  badge?: string;
}) {
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>{title}</h2>
        {badge ? <span>{badge}</span> : null}
      </div>
      <p>{body}</p>
    </section>
  );
}
