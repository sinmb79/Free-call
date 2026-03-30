import { WorkerShell } from "../components/worker-shell";
import { WorkerWorkspace } from "../components/worker-workspace";

export default function WorkerDashboardPage() {
  return (
    <WorkerShell
      title="Monitor availability, profile, and dispatch readiness."
      description="The worker dashboard signs in against the live API, shows current eligibility, and lets a driver publish presence and device tokens."
    >
      <WorkerWorkspace view="overview" />
    </WorkerShell>
  );
}
