import { AppShell } from "../components/app-shell";
import { CustomerWorkspace } from "../components/customer-workspace";

const nav = [
  { href: "/freecab", label: "FreeCab" },
  { href: "/freedrive", label: "FreeDrive" },
  { href: "/freecargo", label: "FreeCargo" },
  { href: "/freerun", label: "FreeRun" },
  { href: "/freeshuttle", label: "FreeShuttle" },
  { href: "/track", label: "Track" },
  { href: "/history", label: "History" }
];

export default function CustomerHomePage() {
  return (
    <AppShell
      eyebrow="Customer App"
      title="Run the full customer dispatch flow from one workspace."
      description="Sign in with the demo OTP, review persisted jobs, and move into the module-specific booking surfaces from the navigation grid."
      nav={nav}
      accent={
        <div className="accent-panel">
          <strong>Live customer flow</strong>
          <span>Registration, login, dispatch creation, history tracking, and shuttle seat booking are all wired to the IwootCall API.</span>
        </div>
      }
    >
      <CustomerWorkspace view="overview" />
    </AppShell>
  );
}
