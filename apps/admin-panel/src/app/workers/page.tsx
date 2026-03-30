import { AdminShell } from "../../components/admin-shell";
import { AdminWorkspace } from "../../components/admin-workspace";

export default function WorkersPage() {
  return (
    <AdminShell
      title="Review worker roster and approval state."
      description="This route lets operators inspect worker availability and move accounts between pending, active, and suspended states."
    >
      <AdminWorkspace view="workers" />
    </AdminShell>
  );
}
