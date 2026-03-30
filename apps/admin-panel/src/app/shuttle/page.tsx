import { AdminShell } from "../../components/admin-shell";
import { AdminWorkspace } from "../../components/admin-workspace";

export default function ShuttlePage() {
  return (
    <AdminShell
      title="Manage shuttle routes and departures."
      description="Create routes, add schedules, and review booked seats from the admin shuttle inventory view."
    >
      <AdminWorkspace view="shuttle" />
    </AdminShell>
  );
}
