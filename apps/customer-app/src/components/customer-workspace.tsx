"use client";

import { startTransition, useEffect, useState } from "react";
import { ApiError, apiRequest, bearerToken } from "../lib/api";

type CustomerView =
  | "overview"
  | "request"
  | "history"
  | "track"
  | "freerun"
  | "shuttle";

type DispatchModule = "FREECAB" | "FREEDRIVE" | "FREECARGO";
type VehicleType = "SEDAN" | "VAN" | "SUV" | "TRUCK_1TON" | "MOTORCYCLE";

interface CustomerSummary {
  id: string;
  phone: string;
  name: string;
  elderlyMode: boolean;
}

interface CustomerJob {
  id: string;
  module: string;
  status: string;
  originAddress: string;
  destAddress?: string | null;
  estimatedFare?: number | null;
  fare?: number | null;
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

interface CustomerSession {
  token: string;
  customer: CustomerSummary;
}

const SESSION_KEY = "iwootcall.customer.session";

const DEFAULT_REQUEST_FORM = {
  originAddress: "Seoul Station",
  originLat: "37.5551",
  originLng: "126.9707",
  destAddress: "City Hall",
  destLat: "37.5663",
  destLng: "126.9779",
  vehicleType: "SEDAN" as VehicleType,
  needsLoadingHelp: false
};

const DEFAULT_BATCH_FORM = {
  originAddress: "Mapo Store",
  originLat: "37.5505",
  originLng: "126.9147",
  vehicleType: "MOTORCYCLE" as VehicleType,
  stops:
    "37.5573,126.9240,Hongdae Gate,01000000001,Coffee\n37.5634,126.9751,City Hall Lobby,01000000002,Documents"
};

const DEFAULT_SHUTTLE_FORM = {
  routeId: "",
  scheduleId: "",
  originAddress: "Village Hall",
  originLat: "37.79",
  originLng: "127.04"
};

export function CustomerWorkspace(props: {
  view: CustomerView;
  module?: DispatchModule;
}) {
  const { view, module } = props;
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const [routes, setRoutes] = useState<ShuttleRoute[]>([]);
  const [schedules, setSchedules] = useState<ShuttleSchedule[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    phone: "01099990001",
    name: "Demo Customer",
    otpCode: "000000",
    elderlyMode: false
  });
  const [requestForm, setRequestForm] = useState(DEFAULT_REQUEST_FORM);
  const [batchForm, setBatchForm] = useState(DEFAULT_BATCH_FORM);
  const [shuttleForm, setShuttleForm] = useState(DEFAULT_SHUTTLE_FORM);

  useEffect(() => {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as CustomerSession);
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!session) {
      setCustomer(null);
      setJobs([]);
      setRoutes([]);
      setSchedules([]);
      return;
    }

    const token = session.token;
    let cancelled = false;

    async function loadSnapshot(): Promise<void> {
      try {
        const [me, jobPayload, routePayload, schedulePayload] = await Promise.all([
          apiRequest<{ customer: CustomerSummary }>("/customer/me", {
            headers: bearerToken(token)
          }),
          apiRequest<{ jobs: CustomerJob[] }>("/customer/jobs", {
            headers: bearerToken(token)
          }),
          apiRequest<{ routes: ShuttleRoute[] }>("/customer/shuttle/routes", {
            headers: bearerToken(token)
          }),
          apiRequest<{ schedules: ShuttleSchedule[] }>("/customer/shuttle/schedules", {
            headers: bearerToken(token)
          })
        ]);

        if (!cancelled) {
          setCustomer(me.customer);
          setJobs(jobPayload.jobs);
          setRoutes(routePayload.routes);
          setSchedules(schedulePayload.schedules);
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
  }, [session]);

  async function authenticate(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (authMode === "register") {
        await apiRequest("/auth/customer/register", {
          method: "POST",
          body: JSON.stringify({
            phone: authForm.phone,
            name: authForm.name,
            otpCode: authForm.otpCode,
            elderlyMode: authForm.elderlyMode
          })
        });
      }

      const result = await apiRequest<{
        token: string;
        customer: CustomerSummary;
      }>("/auth/customer/login", {
        method: "POST",
        body: JSON.stringify({
          phone: authForm.phone,
          otpCode: authForm.otpCode
        })
      });

      const nextSession = {
        token: result.token,
        customer: result.customer
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      startTransition(() => setSession(nextSession));
      setNotice(
        authMode === "register"
          ? "Customer account created and signed in."
          : "Customer session restored."
      );
    } catch (submitError) {
      setError(toMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  function signOut(): void {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setNotice("Customer session cleared.");
  }

  async function createDispatchRequest(): Promise<void> {
    if (!session || !module) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const metadata =
        module === "FREECAB"
          ? { vehicleType: requestForm.vehicleType }
          : module === "FREECARGO"
            ? {
                vehicleType: "TRUCK_1TON",
                needsLoadingHelp: requestForm.needsLoadingHelp
              }
            : {};

      const result = await apiRequest<{ job: CustomerJob }>("/jobs", {
        method: "POST",
        headers: bearerToken(session.token),
        body: JSON.stringify({
          module,
          originAddress: requestForm.originAddress,
          originLat: Number(requestForm.originLat),
          originLng: Number(requestForm.originLng),
          destAddress: requestForm.destAddress,
          destLat: Number(requestForm.destLat),
          destLng: Number(requestForm.destLng),
          metadata
        })
      });

      setJobs((current) => [result.job, ...current]);
      setNotice(`${moduleLabel(module)} request created with status ${result.job.status}.`);
    } catch (submitError) {
      setError(toMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function createFreeRunBatch(): Promise<void> {
    if (!session) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const stops = batchForm.stops
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [lat, lng, address, recipientPhone, itemDesc] = line.split(",");
          return {
            lat: Number(lat),
            lng: Number(lng),
            address,
            recipientPhone,
            itemDesc
          };
        });

      const result = await apiRequest<{ job: CustomerJob }>("/freerun/batch", {
        method: "POST",
        headers: bearerToken(session.token),
        body: JSON.stringify({
          originAddress: batchForm.originAddress,
          originLat: Number(batchForm.originLat),
          originLng: Number(batchForm.originLng),
          vehicleType: batchForm.vehicleType,
          stops
        })
      });

      setJobs((current) => [result.job, ...current]);
      setNotice(`FreeRun batch created with status ${result.job.status}.`);
    } catch (submitError) {
      setError(toMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function bookShuttleSeat(): Promise<void> {
    if (!session) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await apiRequest<{
        job: CustomerJob;
        schedule: ShuttleSchedule;
      }>("/customer/shuttle/bookings", {
        method: "POST",
        headers: bearerToken(session.token),
        body: JSON.stringify({
          routeId: shuttleForm.routeId,
          scheduleId: shuttleForm.scheduleId,
          originAddress: shuttleForm.originAddress,
          originLat: Number(shuttleForm.originLat),
          originLng: Number(shuttleForm.originLng)
        })
      });

      setJobs((current) => [result.job, ...current]);
      setSchedules((current) =>
        current.map((schedule) =>
          schedule.id === result.schedule.id ? result.schedule : schedule
        )
      );
      setNotice(`Seat booked for ${formatDateTime(result.schedule.departure)}.`);
    } catch (submitError) {
      setError(toMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  const activeJob = jobs.find(
    (job) => !["COMPLETED", "NO_WORKER", "CANCELLED"].includes(job.status)
  );

  return (
    <>
      {!hydrated ? <section className="workspace-card"><h2>Loading customer session</h2></section> : null}
      {hydrated && !session ? (
        <section className="workspace-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Sign In</p>
              <h2>Use the demo OTP flow to enter the customer workspace.</h2>
            </div>
            <div className="pill-row">
              <button type="button" className={authMode === "login" ? "pill active" : "pill"} onClick={() => setAuthMode("login")}>Login</button>
              <button type="button" className={authMode === "register" ? "pill active" : "pill"} onClick={() => setAuthMode("register")}>Register</button>
            </div>
          </div>
          <div className="form-grid">
            <label>Phone<input value={authForm.phone} onChange={(event) => setAuthForm((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label>OTP code<input value={authForm.otpCode} onChange={(event) => setAuthForm((current) => ({ ...current, otpCode: event.target.value }))} /></label>
            {authMode === "register" ? <label>Name<input value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} /></label> : null}
            {authMode === "register" ? <label className="checkbox-field"><input type="checkbox" checked={authForm.elderlyMode} onChange={(event) => setAuthForm((current) => ({ ...current, elderlyMode: event.target.checked }))} />Elderly mode enabled</label> : null}
          </div>
          <div className="toolbar">
            <button type="button" onClick={() => void authenticate()} disabled={busy}>{busy ? "Working..." : authMode === "login" ? "Login" : "Register and Login"}</button>
            <span className="hint">Dev OTP is fixed to 000000.</span>
          </div>
        </section>
      ) : null}
      {session ? (
        <>
          <section className="workspace-card tone-dark">
            <div className="section-head">
              <div>
                <p className="section-kicker">Session</p>
                <h2>{customer?.name ?? session.customer.name}</h2>
                <p className="muted-copy">
                  {customer?.phone ?? session.customer.phone} and{" "}
                  {customer?.elderlyMode ? "elderly mode on" : "standard mode"}
                </p>
              </div>
              <div className="toolbar">
                <button type="button" className="secondary-button" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
            <div className="stat-grid">
              <Metric label="Jobs" value={String(jobs.length)} />
              <Metric label="Shuttle routes" value={String(routes.length)} />
              <Metric label="Schedules" value={String(schedules.length)} />
              <Metric label="Active job" value={activeJob ? activeJob.status : "none"} />
            </div>
          </section>

          {error ? <Banner tone="error" message={error} /> : null}
          {notice ? <Banner tone="success" message={notice} /> : null}

          {view === "overview" ? (
            <section className="workspace-card">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Overview</p>
                  <h2>Customer operation snapshot</h2>
                </div>
              </div>
              <div className="detail-grid">
                <SummaryList
                  title="Recent jobs"
                  empty="No jobs yet."
                  items={jobs.slice(0, 4).map((job) => ({
                    id: job.id,
                    title: `${moduleLabel(job.module)} · ${job.status}`,
                    body: `${job.originAddress}${job.destAddress ? ` → ${job.destAddress}` : ""}`
                  }))}
                />
                <SummaryList
                  title="Shuttle routes"
                  empty="No routes published yet."
                  items={routes.map((route) => ({
                    id: route.id,
                    title: route.name,
                    body: route.regionCode
                  }))}
                />
              </div>
            </section>
          ) : null}

          {view === "request" && module ? (
            <section className="workspace-card">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Dispatch</p>
                  <h2>Create a {moduleLabel(module)} request</h2>
                </div>
              </div>
              <div className="form-grid">
                <label>Origin address<input value={requestForm.originAddress} onChange={(event) => setRequestForm((current) => ({ ...current, originAddress: event.target.value }))} /></label>
                <label>Origin latitude<input value={requestForm.originLat} onChange={(event) => setRequestForm((current) => ({ ...current, originLat: event.target.value }))} /></label>
                <label>Origin longitude<input value={requestForm.originLng} onChange={(event) => setRequestForm((current) => ({ ...current, originLng: event.target.value }))} /></label>
                <label>Destination address<input value={requestForm.destAddress} onChange={(event) => setRequestForm((current) => ({ ...current, destAddress: event.target.value }))} /></label>
                <label>Destination latitude<input value={requestForm.destLat} onChange={(event) => setRequestForm((current) => ({ ...current, destLat: event.target.value }))} /></label>
                <label>Destination longitude<input value={requestForm.destLng} onChange={(event) => setRequestForm((current) => ({ ...current, destLng: event.target.value }))} /></label>
                {module === "FREECAB" ? (
                  <label>
                    Vehicle type
                    <select value={requestForm.vehicleType} onChange={(event) => setRequestForm((current) => ({ ...current, vehicleType: event.target.value as VehicleType }))}>
                      <option value="SEDAN">SEDAN</option>
                      <option value="VAN">VAN</option>
                      <option value="SUV">SUV</option>
                    </select>
                  </label>
                ) : null}
                {module === "FREECARGO" ? (
                  <label className="checkbox-field">
                    <input type="checkbox" checked={requestForm.needsLoadingHelp} onChange={(event) => setRequestForm((current) => ({ ...current, needsLoadingHelp: event.target.checked }))} />
                    Loading help required
                  </label>
                ) : null}
              </div>
              <div className="toolbar">
                <button type="button" onClick={() => void createDispatchRequest()} disabled={busy}>
                  {busy ? "Submitting..." : `Create ${moduleLabel(module)} request`}
                </button>
              </div>
            </section>
          ) : null}

          {view === "history" ? (
            <section className="workspace-card">
              <div className="section-head">
                <div>
                  <p className="section-kicker">History</p>
                  <h2>Customer job list</h2>
                </div>
              </div>
              <JobTable jobs={jobs} emptyLabel="No jobs yet." />
            </section>
          ) : null}

          {view === "track" ? (
            <section className="workspace-card">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Tracking</p>
                  <h2>Live dispatch focus</h2>
                </div>
              </div>
              {activeJob ? (
                <div className="track-card">
                  <strong>
                    {moduleLabel(activeJob.module)} · {activeJob.status}
                  </strong>
                  <p>
                    {activeJob.originAddress}
                    {activeJob.destAddress ? ` → ${activeJob.destAddress}` : ""}
                  </p>
                  <span>
                    Estimated fare: {formatCurrency(activeJob.estimatedFare ?? activeJob.fare ?? 0)}
                  </span>
                </div>
              ) : (
                <p className="muted-copy">No active job is waiting for tracking.</p>
              )}
            </section>
          ) : null}

          {view === "freerun" ? (
            <section className="workspace-card">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Batch</p>
                  <h2>Create a FreeRun multi-stop request</h2>
                </div>
              </div>
              <div className="form-grid">
                <label>Pickup address<input value={batchForm.originAddress} onChange={(event) => setBatchForm((current) => ({ ...current, originAddress: event.target.value }))} /></label>
                <label>Pickup latitude<input value={batchForm.originLat} onChange={(event) => setBatchForm((current) => ({ ...current, originLat: event.target.value }))} /></label>
                <label>Pickup longitude<input value={batchForm.originLng} onChange={(event) => setBatchForm((current) => ({ ...current, originLng: event.target.value }))} /></label>
                <label>
                  Vehicle type
                  <select value={batchForm.vehicleType} onChange={(event) => setBatchForm((current) => ({ ...current, vehicleType: event.target.value as VehicleType }))}>
                    <option value="MOTORCYCLE">MOTORCYCLE</option>
                    <option value="VAN">VAN</option>
                    <option value="TRUCK_1TON">TRUCK_1TON</option>
                  </select>
                </label>
                <label className="full-span">Stops<textarea rows={6} value={batchForm.stops} onChange={(event) => setBatchForm((current) => ({ ...current, stops: event.target.value }))} /></label>
              </div>
              <div className="toolbar">
                <button type="button" onClick={() => void createFreeRunBatch()} disabled={busy}>{busy ? "Submitting..." : "Create FreeRun batch"}</button>
                <span className="hint">Format each stop as latitude,longitude,address,recipientPhone,itemDesc</span>
              </div>
            </section>
          ) : null}

          {view === "shuttle" ? (
            <section className="workspace-card">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Shuttle</p>
                  <h2>Browse routes and book seats</h2>
                </div>
              </div>
              <div className="detail-grid">
                <SummaryList title="Routes" empty="No routes yet." items={routes.map((route) => ({ id: route.id, title: route.name, body: route.regionCode }))} />
                <SummaryList title="Schedules" empty="No schedules yet." items={schedules.map((schedule) => ({ id: schedule.id, title: formatDateTime(schedule.departure), body: `${schedule.bookedSeats}/${schedule.seats} seats booked` }))} />
              </div>
              <div className="form-grid">
                <label>
                  Route
                  <select value={shuttleForm.routeId} onChange={(event) => setShuttleForm((current) => ({ ...current, routeId: event.target.value }))}>
                    <option value="">Select a route</option>
                    {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
                  </select>
                </label>
                <label>
                  Schedule
                  <select value={shuttleForm.scheduleId} onChange={(event) => setShuttleForm((current) => ({ ...current, scheduleId: event.target.value }))}>
                    <option value="">Select a schedule</option>
                    {schedules.filter((schedule) => shuttleForm.routeId ? schedule.routeId === shuttleForm.routeId : true).map((schedule) => <option key={schedule.id} value={schedule.id}>{formatDateTime(schedule.departure)} · {schedule.bookedSeats}/{schedule.seats}</option>)}
                  </select>
                </label>
                <label>Boarding address<input value={shuttleForm.originAddress} onChange={(event) => setShuttleForm((current) => ({ ...current, originAddress: event.target.value }))} /></label>
                <label>Boarding latitude<input value={shuttleForm.originLat} onChange={(event) => setShuttleForm((current) => ({ ...current, originLat: event.target.value }))} /></label>
                <label>Boarding longitude<input value={shuttleForm.originLng} onChange={(event) => setShuttleForm((current) => ({ ...current, originLng: event.target.value }))} /></label>
              </div>
              <div className="toolbar">
                <button type="button" onClick={() => void bookShuttleSeat()} disabled={busy}>{busy ? "Booking..." : "Book a seat"}</button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function Metric(props: { label: string; value: string }) {
  return <div className="metric-tile"><span>{props.label}</span><strong>{props.value}</strong></div>;
}

function Banner(props: { tone: "success" | "error"; message: string }) {
  return <section className={`banner ${props.tone}`}><p>{props.message}</p></section>;
}

function SummaryList(props: { title: string; empty: string; items: Array<{ id: string; title: string; body: string }> }) {
  return (
    <section className="workspace-card nested-card">
      <h3>{props.title}</h3>
      {props.items.length === 0 ? <p className="muted-copy">{props.empty}</p> : (
        <ul className="data-list">
          {props.items.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.body}</span></li>)}
        </ul>
      )}
    </section>
  );
}

function JobTable(props: { jobs: CustomerJob[]; emptyLabel: string }) {
  if (props.jobs.length === 0) {
    return <p className="muted-copy">{props.emptyLabel}</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Module</th><th>Status</th><th>Route</th><th>Fare</th></tr></thead>
        <tbody>
          {props.jobs.map((job) => (
            <tr key={job.id}>
              <td>{moduleLabel(job.module)}</td>
              <td>{job.status}</td>
              <td>{job.originAddress}{job.destAddress ? ` → ${job.destAddress}` : ""}</td>
              <td>{formatCurrency(job.fare ?? job.estimatedFare ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function moduleLabel(module: string): string {
  switch (module) {
    case "FREECAB":
      return "FreeCab";
    case "FREEDRIVE":
      return "FreeDrive";
    case "FREECARGO":
      return "FreeCargo";
    case "FREERUN":
      return "FreeRun";
    case "FREESHUTTLE":
      return "FreeShuttle";
    default:
      return module;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
