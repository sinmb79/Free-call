import Link from "next/link";
import type { PropsWithChildren } from "react";

interface WorkerShellProps extends PropsWithChildren {
  title: string;
  description: string;
}

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/active", label: "Active Job" },
  { href: "/earnings", label: "Earnings" }
];

export function WorkerShell({
  title,
  description,
  children
}: WorkerShellProps) {
  return (
    <div className="worker-shell">
      <aside className="worker-sidebar">
        <p className="eyebrow">Worker App</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <nav className="worker-nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="worker-main">{children}</main>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
