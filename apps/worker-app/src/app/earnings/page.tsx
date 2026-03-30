import { WorkerShell } from "../../components/worker-shell";
import { WorkerWorkspace } from "../../components/worker-workspace";

export default function WorkerEarningsPage() {
  return (
    <WorkerShell
      title="Review today's completed work and payout summary."
      description="The earnings route reads the persisted worker summary so drivers can quickly sanity-check their daily output."
    >
      <WorkerWorkspace view="earnings" />
    </WorkerShell>
  );
}
