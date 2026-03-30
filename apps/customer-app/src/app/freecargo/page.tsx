import { AppShell } from "../../components/app-shell";
import { CustomerWorkspace } from "../../components/customer-workspace";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/freecab", label: "FreeCab" },
  { href: "/freedrive", label: "FreeDrive" },
  { href: "/freerun", label: "FreeRun" },
  { href: "/freeshuttle", label: "FreeShuttle" },
  { href: "/track", label: "Track" },
  { href: "/history", label: "History" }
];

export default function FreeCargoPage() {
  return (
    <AppShell
      eyebrow="FreeCargo"
      title="Send a load-aware cargo request."
      description="FreeCargo shares the request base, but adds a lightweight loading-help toggle before the job enters dispatch."
      nav={nav}
      accent={<div className="accent-panel"><strong>Load-aware intake</strong><span>Keep the cargo surface short while still capturing the metadata operators need.</span></div>}
    >
      <CustomerWorkspace view="request" module="FREECARGO" />
    </AppShell>
  );
}
