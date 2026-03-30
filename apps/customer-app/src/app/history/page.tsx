import { AppShell } from "../../components/app-shell";
import { CustomerWorkspace } from "../../components/customer-workspace";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/freecab", label: "FreeCab" },
  { href: "/freedrive", label: "FreeDrive" },
  { href: "/freecargo", label: "FreeCargo" },
  { href: "/freerun", label: "FreeRun" },
  { href: "/freeshuttle", label: "FreeShuttle" },
  { href: "/track", label: "Track" }
];

export default function HistoryPage() {
  return (
    <AppShell
      eyebrow="History"
      title="Review the full customer job stream."
      description="This route reads the persisted customer jobs API and presents the request history with status and fare values."
      nav={nav}
      accent={<div className="accent-panel"><strong>Session recap</strong><span>Keep recent requests close without jumping into the operator surfaces.</span></div>}
    >
      <CustomerWorkspace view="history" />
    </AppShell>
  );
}
