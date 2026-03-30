import { AppShell } from "../../components/app-shell";
import { CustomerWorkspace } from "../../components/customer-workspace";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/freecab", label: "FreeCab" },
  { href: "/freedrive", label: "FreeDrive" },
  { href: "/freecargo", label: "FreeCargo" },
  { href: "/freerun", label: "FreeRun" },
  { href: "/track", label: "Track" },
  { href: "/history", label: "History" }
];

export default function FreeShuttlePage() {
  return (
    <AppShell
      eyebrow="FreeShuttle"
      title="Browse routes and reserve shared seats."
      description="Published routes and schedules stream from the customer shuttle APIs, and bookings return both the seat update and the created job."
      nav={nav}
      accent={<div className="accent-panel"><strong>Seat booking</strong><span>Pick a route, choose a departure, and book directly into the shuttle schedule inventory.</span></div>}
    >
      <CustomerWorkspace view="shuttle" />
    </AppShell>
  );
}
