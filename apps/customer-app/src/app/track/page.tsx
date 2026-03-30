import { AppShell } from "../../components/app-shell";
import { CustomerWorkspace } from "../../components/customer-workspace";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/freecab", label: "FreeCab" },
  { href: "/freedrive", label: "FreeDrive" },
  { href: "/freecargo", label: "FreeCargo" },
  { href: "/freerun", label: "FreeRun" },
  { href: "/freeshuttle", label: "FreeShuttle" },
  { href: "/history", label: "History" }
];

export default function TrackPage() {
  return (
    <AppShell
      eyebrow="Tracking"
      title="Keep the current dispatch in view."
      description="This page focuses on the latest in-flight job while the richer realtime map layer remains the next upgrade."
      nav={nav}
      accent={<div className="accent-panel"><strong>Realtime next</strong><span>The shared socket layer is already in the backend, so this page can deepen into a live map later.</span></div>}
    >
      <CustomerWorkspace view="track" />
    </AppShell>
  );
}
