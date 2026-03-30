import Link from "next/link";
import type { PropsWithChildren, ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
}

interface AppShellProps extends PropsWithChildren {
  eyebrow: string;
  title: string;
  description: string;
  nav: NavItem[];
  accent: ReactNode;
}

export function AppShell({
  eyebrow,
  title,
  description,
  nav,
  accent,
  children
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hero-copy">{description}</p>
        </div>
        <div className="hero-accent">{accent}</div>
      </header>

      <nav className="nav-grid" aria-label="Customer navigation">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="nav-tile">
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="content-grid">{children}</main>
    </div>
  );
}

export function InfoCard({
  title,
  body,
  detail
}: {
  title: string;
  body: string;
  detail?: string;
}) {
  return (
    <section className="info-card">
      <h2>{title}</h2>
      <p>{body}</p>
      {detail ? <span>{detail}</span> : null}
    </section>
  );
}
