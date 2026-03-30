import { AdminShell } from "../../components/admin-shell";
import { AdminWorkspace } from "../../components/admin-workspace";

export default function JobsPage() {
  return (
    <AdminShell
      title="Inspect the current jobs stream."
      description="Jobs are pulled from the persisted admin jobs API so operators can review status, assignment, and fare context."
    >
      <AdminWorkspace view="jobs" />
    </AdminShell>
  );
}
