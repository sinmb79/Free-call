import { AppShell } from "../../components/app-shell";
import { CustomerWorkspace } from "../../components/customer-workspace";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/freecab", label: "FreeCab" },
  { href: "/freedrive", label: "FreeDrive" },
  { href: "/freecargo", label: "FreeCargo" },
  { href: "/freeshuttle", label: "FreeShuttle" },
  { href: "/track", label: "Track" },
  { href: "/history", label: "History" }
];

export default function FreeRunPage() {
  return (
    <AppShell
      eyebrow="FreeRun"
      title="Compose a multi-stop runner batch."
      description="This surface targets the dedicated `/freerun/batch` API and keeps stop planning close to the customer workspace."
      nav={nav}
      accent={<div className="accent-panel"><strong>Batch intake</strong><span>Paste one stop per line and let the backend reorder them into the optimized route.</span></div>}
    >
      <CustomerWorkspace view="freerun" />
    </AppShell>
  );
}
