"use client";

import { useEffect, useState } from "react";
import { ApiError, apiRequest, bearerToken } from "../lib/api";

type AdminView = "overview" | "workers" | "jobs" | "stats" | "shuttle";
type WorkerStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

interface AdminSummaryStats {
  totalJobs: number;
  completedJobs: number;
  grossFare: number;
  activeWorkers: number;
  onlineWorkers: number;
}

interface AdminModuleStats {
  module: string;
  totalJobs: number;
  completedJobs: number;
  grossFare: number;
  activeWorkers: number;
  onlineWorkers: number;
}

interface WorkerRecord {
  id: string;
  phone: string;
  name: string;
  module: string;
  status: WorkerStatus;
  isOnline: boolean;
  vehicleNumber: string;
}

interface JobRecord {
  id: string;
  module: string;
  status: string;
  customerId: string;
  workerId?: string | null;
  originAddress: string;
  destAddress?: string | null;
  fare?: number | null;
  estimatedFare?: number | null;
}

interface ShuttleRoute {
  id: string;
  name: string;
  regionCode: string;
}

interface ShuttleSchedule {
  id: string;
  routeId: string;
  departure: string;
  seats: number;
  bookedSeats: number;
}

const TOKEN_KEY = "iwootcall.admin.token";

export function AdminWorkspace(props: { view: AdminView }) {
  const { view } = props;
  const [token, setToken] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminSummaryStats | null>(null);
  const [modules, setModules] = useState<AdminModuleStats[]>([]);
  const [workers, setWorkers] = useState<WorkerRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [routes, setRoutes] = useState<ShuttleRoute[]>([]);
  const [schedules, setSchedules] = useState<ShuttleSchedule[]>([]);
  const [routeForm, setRouteForm] = useState({
    name: "Yangju Morning Loop",
    regionCode: "KR-41630",
    waypoints: "37.79,127.04,Village Hall\n37.8,127.05,Health Center"
  });
  const [scheduleForm, setScheduleForm] = useState({
    routeId: "",
    departure: "2026-04-01T10:00:00.000Z",
    seats: "8"
  });

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setSummary(null);
      setModules([]);
      setWorkers([]);
      setJobs([]);
      setRoutes([]);
      setSchedules([]);
      return;
    }

    let cancelled = false;

    async function loadSnapshot(): Promise<void> {
      try {
        const headers = bearerToken(token);
        const [stats, workerPayload, jobPayload, routePayload, schedulePayload] =
          await Promise.all([
            apiRequest<{ summary: AdminSummaryStats; perModule: AdminModuleStats[] }>(
              "/admin/stats",
              { headers }
            ),
            apiRequest<{ workers: WorkerRecord[] }>("/admin/workers", { headers }),
            apiRequest<{ jobs: JobRecord[] }>("/admin/jobs", { headers }),
            apiRequest<{ routes: ShuttleRoute[] }>("/admin/shuttle/routes", { headers }),
            apiRequest<{ schedules: ShuttleSchedule[] }>("/admin/shuttle/schedules", {
              headers
            })
          ]);

        if (!cancelled) {
          setSummary(stats.summary);
          setModules(stats.perModule);
          setWorkers(workerPayload.workers);
          setJobs(jobPayload.jobs);
          setRoutes(routePayload.routes);
          setSchedules(schedulePayload.schedules);
          setScheduleForm((current) => ({
            ...current,
            routeId: current.routeId || routePayload.routes[0]?.id || ""
          }));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(toMessage(loadError));
        }
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function saveToken(value: string): void {
    window.localStorage.setItem(TOKEN_KEY, value);
    setToken(value);
    setError(null);
    setNotice("Admin token stored locally.");
  }

  async function generateDevToken(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/dev-admin-token", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as { token?: string; message?: string };
      if (!response.ok || !payload.token) {
        throw new Error(payload.message ?? "Failed to generate dev token.");
      }
      saveToken(payload.token);
    } catch (tokenError) {
      setError(toMessage(tokenError));
    } finally {
      setBusy(false);
    }
  }

  async function updateWorkerStatus(id: string, status: WorkerStatus): Promise<void> {
    if (!token) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<{ worker: WorkerRecord }>(
        `/admin/workers/${id}/status`,
        {
          method: "PATCH",
          headers: bearerToken(token),
          body: JSON.stringify({ status })
        }
      );

      setWorkers((current) =>
        current.map((worker) => (worker.id === id ? result.worker : worker))
      );
      setNotice(`Worker moved to ${status}.`);
    } catch (statusError) {
      setError(toMessage(statusError));
    } finally {
      setBusy(false);
    }
  }

  async function createRoute(): Promise<void> {
    if (!token) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const waypoints = routeForm.waypoints
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [lat, lng, label] = line.split(",");
          return {
            lat: Number(lat),
            lng: Number(lng),
            label
          };
        });

      const result = await apiRequest<{ route: ShuttleRoute }>("/admin/shuttle/routes", {
        method: "POST",
        headers: bearerToken(token),
        body: JSON.stringify({
          name: routeForm.name,
          regionCode: routeForm.regionCode,
          waypoints
        })
      });

      setRoutes((current) => [result.route, ...current]);
      setScheduleForm((current) => ({
        ...current,
        routeId: result.route.id
      }));
      setNotice("Shuttle route created.");
    } catch (routeError) {
      setError(toMessage(routeError));
    } finally {
      setBusy(false);
    }
  }

  async function createSchedule(): Promise<void> {
    if (!token) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<{ schedule: ShuttleSchedule }>(
        "/admin/shuttle/schedules",
        {
          method: "POST",
          headers: bearerToken(token),
          body: JSON.stringify({
            routeId: scheduleForm.routeId,
            departure: scheduleForm.departure,
            seats: Number(scheduleForm.seats)
          })
        }
      );

      setSchedules((current) => [result.schedule, ...current]);
      setNotice("Shuttle schedule created.");
    } catch (scheduleError) {
      setError(toMessage(scheduleError));
    } finally {
      setBusy(false);
    }
  }

  function clearToken(): void {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setNotice("Admin token removed.");
  }

  return (
    <>
      {!hydrated ? <section className="admin-card"><p>Loading admin token</p></section> : null}
      {hydrated && !token ? (
        <section className="admin-card admin-wide">
          <div className="admin-card-head">
            <h2>Admin token</h2>
          </div>
          <p>Paste an existing admin bearer token or generate a local dev token from the server-side helper route.</p>
          <div className="form-grid">
            <label className="full-span">
              Bearer token
              <textarea rows={6} value={token} onChange={(event) => setToken(event.target.value)} />
            </label>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => saveToken(token)} disabled={!token || busy}>Use token</button>
            <button type="button" className="secondary-button" onClick={() => void generateDevToken()} disabled={busy}>Generate local dev token</button>
          </div>
        </section>
      ) : null}
      {token ? (
        <>
          {error ? <section className="admin-banner error"><p>{error}</p></section> : null}
          {notice ? <section className="admin-banner success"><p>{notice}</p></section> : null}

          {view === "overview" && summary ? (
            <>
              <Metric title="Live jobs" value={String(summary.totalJobs)} />
              <Metric title="Completed jobs" value={String(summary.completedJobs)} />
              <Metric title="Active workers" value={String(summary.activeWorkers)} />
              <Metric title="Online workers" value={String(summary.onlineWorkers)} />
              <section className="admin-card admin-wide">
                <div className="admin-card-head">
                  <h2>Gross fare</h2>
                  <span>Today</span>
                </div>
                <p>{formatCurrency(summary.grossFare)}</p>
                <div className="admin-actions">
                  <button type="button" className="secondary-button" onClick={clearToken}>Clear token</button>
                </div>
              </section>
            </>
          ) : null}

          {view === "workers" ? (
            <section className="admin-card admin-wide">
              <div className="admin-card-head"><h2>Workers</h2><span>{workers.length}</span></div>
              {workers.length === 0 ? <p>No workers yet.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Module</th><th>Status</th><th>Online</th><th>Action</th></tr></thead>
                    <tbody>
                      {workers.map((worker) => (
                        <tr key={worker.id}>
                          <td>{worker.name}</td>
                          <td>{worker.module}</td>
                          <td>{worker.status}</td>
                          <td>{worker.isOnline ? "YES" : "NO"}</td>
                          <td>
                            <div className="admin-actions">
                              <button type="button" onClick={() => void updateWorkerStatus(worker.id, "ACTIVE")} disabled={busy}>Activate</button>
                              <button type="button" className="secondary-button" onClick={() => void updateWorkerStatus(worker.id, "SUSPENDED")} disabled={busy}>Suspend</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {view === "jobs" ? (
            <section className="admin-card admin-wide">
              <div className="admin-card-head"><h2>Jobs</h2><span>{jobs.length}</span></div>
              {jobs.length === 0 ? <p>No jobs yet.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Module</th><th>Status</th><th>Customer</th><th>Worker</th><th>Route</th><th>Fare</th></tr></thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id}>
                          <td>{job.module}</td>
                          <td>{job.status}</td>
                          <td>{job.customerId}</td>
                          <td>{job.workerId ?? "-"}</td>
                          <td>{job.originAddress}{job.destAddress ? ` → ${job.destAddress}` : ""}</td>
                          <td>{formatCurrency(job.fare ?? job.estimatedFare ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {view === "stats" ? (
            <section className="admin-card admin-wide">
              <div className="admin-card-head"><h2>Per-module stats</h2><span>{modules.length}</span></div>
              {modules.length === 0 ? <p>No module stats yet.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Module</th><th>Total jobs</th><th>Completed</th><th>Gross fare</th><th>Active workers</th><th>Online workers</th></tr></thead>
                    <tbody>
                      {modules.map((module) => (
                        <tr key={module.module}>
                          <td>{module.module}</td>
                          <td>{module.totalJobs}</td>
                          <td>{module.completedJobs}</td>
                          <td>{formatCurrency(module.grossFare)}</td>
                          <td>{module.activeWorkers}</td>
                          <td>{module.onlineWorkers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {view === "shuttle" ? (
            <>
              <section className="admin-card admin-wide">
                <div className="admin-card-head"><h2>Shuttle routes</h2><span>{routes.length}</span></div>
                <div className="form-grid">
                  <label>Name<input value={routeForm.name} onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))} /></label>
                  <label>Region code<input value={routeForm.regionCode} onChange={(event) => setRouteForm((current) => ({ ...current, regionCode: event.target.value }))} /></label>
                  <label className="full-span">Waypoints<textarea rows={6} value={routeForm.waypoints} onChange={(event) => setRouteForm((current) => ({ ...current, waypoints: event.target.value }))} /></label>
                </div>
                <div className="admin-actions"><button type="button" onClick={() => void createRoute()} disabled={busy}>Create route</button></div>
              </section>
              <section className="admin-card admin-wide">
                <div className="admin-card-head"><h2>Shuttle schedules</h2><span>{schedules.length}</span></div>
                <div className="form-grid">
                  <label>
                    Route
                    <select value={scheduleForm.routeId} onChange={(event) => setScheduleForm((current) => ({ ...current, routeId: event.target.value }))}>
                      <option value="">Select route</option>
                      {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
                    </select>
                  </label>
                  <label>Departure<input value={scheduleForm.departure} onChange={(event) => setScheduleForm((current) => ({ ...current, departure: event.target.value }))} /></label>
                  <label>Seats<input value={scheduleForm.seats} onChange={(event) => setScheduleForm((current) => ({ ...current, seats: event.target.value }))} /></label>
                </div>
                <div className="admin-actions"><button type="button" onClick={() => void createSchedule()} disabled={busy || !scheduleForm.routeId}>Create schedule</button></div>
              </section>
              <section className="admin-card admin-wide">
                <div className="admin-card-head"><h2>Current shuttle inventory</h2></div>
                {schedules.length === 0 ? <p>No schedules yet.</p> : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Route</th><th>Departure</th><th>Seats</th><th>Booked</th></tr></thead>
                      <tbody>
                        {schedules.map((schedule) => (
                          <tr key={schedule.id}>
                            <td>{routes.find((route) => route.id === schedule.routeId)?.name ?? schedule.routeId}</td>
                            <td>{formatDateTime(schedule.departure)}</td>
                            <td>{schedule.seats}</td>
                            <td>{schedule.bookedSeats}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function Metric(props: { title: string; value: string }) {
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>{props.title}</h2>
      </div>
      <p className="metric-copy">{props.value}</p>
    </section>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}
