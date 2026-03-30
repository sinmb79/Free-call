import { AppShell } from "../../components/app-shell";
import { CustomerWorkspace } from "../../components/customer-workspace";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/freecab", label: "FreeCab" },
  { href: "/freecargo", label: "FreeCargo" },
  { href: "/freerun", label: "FreeRun" },
  { href: "/freeshuttle", label: "FreeShuttle" },
  { href: "/track", label: "Track" },
  { href: "/history", label: "History" }
];

export default function FreeDrivePage() {
  return (
    <AppShell
      eyebrow="FreeDrive"
      title="Request a designated driver flow."
      description="FreeDrive uses the shared dispatch engine, but the customer surface stays calm and focused on a return-home scenario."
      nav={nav}
      accent={<div className="accent-panel"><strong>Return-home mode</strong><span>Keep the form light and submit a designated-driver style dispatch through the shared jobs endpoint.</span></div>}
    >
      <CustomerWorkspace view="request" module="FREEDRIVE" />
    </AppShell>
  );
}
