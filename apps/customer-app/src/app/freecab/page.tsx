import { AppShell } from "../../components/app-shell";
import { CustomerWorkspace } from "../../components/customer-workspace";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/freedrive", label: "FreeDrive" },
  { href: "/freecargo", label: "FreeCargo" },
  { href: "/freerun", label: "FreeRun" },
  { href: "/freeshuttle", label: "FreeShuttle" },
  { href: "/track", label: "Track" },
  { href: "/history", label: "History" }
];

export default function FreeCabPage() {
  return (
    <AppShell
      eyebrow="FreeCab"
      title="Create an immediate city ride request."
      description="This module sends a standard dispatch request through the shared jobs API and drops the created job back into the customer timeline."
      nav={nav}
      accent={<div className="accent-panel"><strong>Fast pickup</strong><span>Use the default Seoul sample coordinates or replace them with live customer locations.</span></div>}
    >
      <CustomerWorkspace view="request" module="FREECAB" />
    </AppShell>
  );
}
