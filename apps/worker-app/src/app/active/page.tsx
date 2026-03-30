import { WorkerShell } from "../../components/worker-shell";
import { WorkerWorkspace } from "../../components/worker-workspace";

export default function WorkerActivePage() {
  return (
    <WorkerShell
      title="Inspect the active job and module-specific settings."
      description="This route surfaces the accepted workload and the worker-side controls for FreeDrive and FreeCargo profiles."
    >
      <WorkerWorkspace view="active" />
    </WorkerShell>
  );
}
