import { AdminShell } from "../components/admin-shell";
import { AdminWorkspace } from "../components/admin-workspace";

export default function AdminHomePage() {
  return (
    <AdminShell
      title="Monitor live operations from a single admin surface."
      description="The admin panel reads the live stats, worker, job, and shuttle APIs once an admin token is available."
    >
      <AdminWorkspace view="overview" />
    </AdminShell>
  );
}
