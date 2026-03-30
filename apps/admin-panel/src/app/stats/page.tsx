import { AdminShell } from "../../components/admin-shell";
import { AdminWorkspace } from "../../components/admin-workspace";

export default function StatsPage() {
  return (
    <AdminShell
      title="Break down platform stats by module."
      description="This route focuses on the summary and per-module metrics returned by the admin stats endpoint."
    >
      <AdminWorkspace view="stats" />
    </AdminShell>
  );
}
