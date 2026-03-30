"use client";

import { startTransition, useEffect, useState } from "react";
import { ApiError, apiRequest, bearerToken } from "../lib/api";
import { MetricCard } from "./worker-shell";

type WorkerView = "overview" | "active" | "earnings";
type WorkerModule = "FREECAB" | "FREEDRIVE" | "FREECARGO" | "FREERUN";
type VehicleType =
  | "SEDAN"
  | "VAN"
  | "SUV"
  | "ANY"
  | "TRUCK_1TON"
  | "MOTORCYCLE";

interface WorkerSummary {
  id: string;
  phone: string;
  name: string;
  module: WorkerModule;
  vehicleType: VehicleType;
  vehicleNumber: string;
  status: string;
  isOnline: boolean;
  lat?: number | null;
  lng?: number | null;
  fcmToken?: string | null;
}

interface ActiveJob {
  id: string;
  module: string;
  status: string;
  originAddress: string;
  destAddress?: string | null;
  estimatedFare?: number | null;
  fare?: number | null;
}

interface EarningsSummary {
  totalEarnings: number;
  completedJobs: number;
}

interface WorkerSession {
  token: string;
  worker: WorkerSummary;
}

const SESSION_KEY = "iwootcall.worker.session";

export function WorkerWorkspace(props: { view: WorkerView }) {
  const { view } = props;
  const [session, setSession] = useState<WorkerSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [worker, setWorker] = useState<WorkerSummary | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [driveProfile, setDriveProfile] = useState({ maxReturnWalkMeters: "1500" });
  const [cargoProfile, setCargoProfile] = useState({
    canLoadingHelp: false,
    hasForklift: false,
    businessRegNo: ""
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    phone: "01099990011",
    name: "Demo Worker",
    module: "FREECAB" as WorkerModule,
    vehicleType: "SEDAN" as VehicleType,
    vehicleNumber: "99A1011",
    otpCode: "000000"
  });
  const [presenceForm, setPresenceForm] = useState({
    isOnline: false,
    lat: "37.5551",
    lng: "126.9707",
    fcmToken: "worker-demo-device"
  });

  useEffect(() => {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as WorkerSession);
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!session) {
      setWorker(null);
      setActiveJob(null);
      setEarnings(null);
      return;
    }

    const token = session.token;
    let cancelled = false;

    async function loadSnapshot(): Promise<void> {
      try {
        const [me, active, summary] = await Promise.all([
          apiRequest<{ worker: WorkerSummary }>("/worker/me", {
            headers: bearerToken(token)
          }),
          apiRequest<{ job: ActiveJob | null }>("/worker/jobs/active", {
            headers: bearerToken(token)
          }),
          apiRequest<{ summary: EarningsSummary }>("/worker/earnings/today", {
            headers: bearerToken(token)
          })
        ]);

        if (!cancelled) {
          setWorker(me.worker);
          setActiveJob(active.job);
          setEarnings(summary.summary);
          setPresenceForm((current) => ({
            ...current,
            isOnline: me.worker.isOnline,
            lat: String(me.worker.lat ?? 37.5551),
            lng: String(me.worker.lng ?? 126.9707),
            fcmToken: me.worker.fcmToken ?? current.fcmToken
          }));
        }

        if (me.worker.module === "FREEDRIVE") {
          const profile = await apiRequest<{ profile: { maxReturnWalkMeters: number } }>(
            "/worker/drive-profile",
            { headers: bearerToken(token) }
          );
          if (!cancelled) {
            setDriveProfile({
              maxReturnWalkMeters: String(profile.profile.maxReturnWalkMeters)
            });
          }
        }

        if (me.worker.module === "FREECARGO") {
          const profile = await apiRequest<{
            profile: {
              canLoadingHelp: boolean;
              hasForklift: boolean;
              businessRegNo: string | null;
            };
          }>("/worker/cargo-profile", {
            headers: bearerToken(token)
          });
          if (!cancelled) {
            setCargoProfile({
              canLoadingHelp: profile.profile.canLoadingHelp,
              hasForklift: profile.profile.hasForklift,
              businessRegNo: profile.profile.businessRegNo ?? ""
            });
          }
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
        await apiRequest("/auth/worker/register", {
          method: "POST",
          body: JSON.stringify(authForm)
        });
      }

      const result = await apiRequest<{
        token: string;
        worker: WorkerSummary;
      }>("/auth/worker/login", {
        method: "POST",
        body: JSON.stringify({
          phone: authForm.phone,
          otpCode: authForm.otpCode
        })
      });

      const nextSession = {
        token: result.token,
        worker: result.worker
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      startTransition(() => setSession(nextSession));
      setNotice(
        authMode === "register"
          ? "Worker account created and signed in."
          : "Worker session restored."
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
    setNotice("Worker session cleared.");
  }

  async function updatePresence(): Promise<void> {
    if (!session) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const presence = await apiRequest<{ worker: WorkerSummary }>("/worker/presence", {
        method: "PATCH",
        headers: bearerToken(session.token),
        body: JSON.stringify({
          isOnline: presenceForm.isOnline,
          lat: Number(presenceForm.lat),
          lng: Number(presenceForm.lng)
        })
      });
      const device = await apiRequest<{ worker: WorkerSummary }>("/worker/device", {
        method: "PATCH",
        headers: bearerToken(session.token),
        body: JSON.stringify({
          fcmToken: presenceForm.fcmToken
        })
      });

      setWorker(device.worker);
      setSession((current) =>
        current ? { ...current, worker: device.worker } : current
      );
      setNotice(
        `Presence updated to ${presence.worker.isOnline ? "online" : "offline"}.`
      );
    } catch (submitError) {
      setError(toMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function saveModuleProfile(): Promise<void> {
    if (!session || !worker) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (worker.module === "FREEDRIVE") {
        await apiRequest("/worker/drive-profile", {
          method: "PATCH",
          headers: bearerToken(session.token),
          body: JSON.stringify({
            maxReturnWalkMeters: Number(driveProfile.maxReturnWalkMeters)
          })
        });
        setNotice("Drive profile updated.");
      }

      if (worker.module === "FREECARGO") {
        await apiRequest("/worker/cargo-profile", {
          method: "PATCH",
          headers: bearerToken(session.token),
          body: JSON.stringify(cargoProfile)
        });
        setNotice("Cargo profile updated.");
      }
    } catch (submitError) {
      setError(toMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!hydrated ? <section className="metric-card"><strong>Loading session</strong></section> : null}
      {hydrated && !session ? (
        <section className="panel-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Authentication</p>
              <h2>Enter the worker workspace.</h2>
            </div>
            <div className="toggle-row">
              <button type="button" className={authMode === "login" ? "toggle active" : "toggle"} onClick={() => setAuthMode("login")}>Login</button>
              <button type="button" className={authMode === "register" ? "toggle active" : "toggle"} onClick={() => setAuthMode("register")}>Register</button>
            </div>
          </div>
          <div className="form-grid">
            <label>Phone<input value={authForm.phone} onChange={(event) => setAuthForm((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label>OTP<input value={authForm.otpCode} onChange={(event) => setAuthForm((current) => ({ ...current, otpCode: event.target.value }))} /></label>
            {authMode === "register" ? <label>Name<input value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} /></label> : null}
            {authMode === "register" ? <label>Module<select value={authForm.module} onChange={(event) => setAuthForm((current) => ({ ...current, module: event.target.value as WorkerModule }))}><option value="FREECAB">FREECAB</option><option value="FREEDRIVE">FREEDRIVE</option><option value="FREECARGO">FREECARGO</option><option value="FREERUN">FREERUN</option></select></label> : null}
            {authMode === "register" ? <label>Vehicle type<select value={authForm.vehicleType} onChange={(event) => setAuthForm((current) => ({ ...current, vehicleType: event.target.value as VehicleType }))}><option value="SEDAN">SEDAN</option><option value="VAN">VAN</option><option value="SUV">SUV</option><option value="ANY">ANY</option><option value="TRUCK_1TON">TRUCK_1TON</option><option value="MOTORCYCLE">MOTORCYCLE</option></select></label> : null}
            {authMode === "register" ? <label>Vehicle number<input value={authForm.vehicleNumber} onChange={(event) => setAuthForm((current) => ({ ...current, vehicleNumber: event.target.value }))} /></label> : null}
          </div>
          <div className="panel-actions">
            <button type="button" onClick={() => void authenticate()} disabled={busy}>{busy ? "Working..." : authMode === "login" ? "Login" : "Register and Login"}</button>
            <span>Dev OTP is fixed to 000000.</span>
          </div>
        </section>
      ) : null}
      {session && worker ? (
        <>
          {error ? <section className="status-banner error"><p>{error}</p></section> : null}
          {notice ? <section className="status-banner success"><p>{notice}</p></section> : null}

          {view === "overview" ? (
            <>
              <MetricCard label="Module" value={worker.module} detail={`Status ${worker.status} · vehicle ${worker.vehicleNumber}`} />
              <MetricCard label="Presence" value={worker.isOnline ? "ONLINE" : "OFFLINE"} detail={`lat ${worker.lat ?? "-"} · lng ${worker.lng ?? "-"}`} />
              <MetricCard label="Device token" value={worker.fcmToken ? "BOUND" : "EMPTY"} detail="Used by the notification delivery layer." />
              <section className="panel-card wide-card">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Presence</p>
                    <h2>Update live availability</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={signOut}>Sign out</button>
                </div>
                <div className="form-grid">
                  <label className="checkbox-field"><input type="checkbox" checked={presenceForm.isOnline} onChange={(event) => setPresenceForm((current) => ({ ...current, isOnline: event.target.checked }))} />Worker online</label>
                  <label>Latitude<input value={presenceForm.lat} onChange={(event) => setPresenceForm((current) => ({ ...current, lat: event.target.value }))} /></label>
                  <label>Longitude<input value={presenceForm.lng} onChange={(event) => setPresenceForm((current) => ({ ...current, lng: event.target.value }))} /></label>
                  <label className="full-span">FCM token<input value={presenceForm.fcmToken} onChange={(event) => setPresenceForm((current) => ({ ...current, fcmToken: event.target.value }))} /></label>
                </div>
                <div className="panel-actions">
                  <button type="button" onClick={() => void updatePresence()} disabled={busy}>{busy ? "Saving..." : "Save presence"}</button>
                </div>
              </section>
            </>
          ) : null}

          {view === "active" ? (
            <>
              <MetricCard label="Active job" value={activeJob ? activeJob.status : "NONE"} detail={activeJob ? `${moduleLabel(activeJob.module)} · ${activeJob.originAddress}` : "No active job is currently assigned."} />
              <section className="panel-card wide-card">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Current workload</p>
                    <h2>Active assignment details</h2>
                  </div>
                </div>
                {activeJob ? (
                  <div className="detail-stack">
                    <strong>{moduleLabel(activeJob.module)} · {activeJob.status}</strong>
                    <p>{activeJob.originAddress}{activeJob.destAddress ? ` → ${activeJob.destAddress}` : ""}</p>
                    <span>Estimated fare {formatCurrency(activeJob.estimatedFare ?? activeJob.fare ?? 0)}</span>
                  </div>
                ) : (
                  <p className="muted-copy">The worker currently has no accepted or started job.</p>
                )}
              </section>
              {worker.module === "FREEDRIVE" ? (
                <section className="panel-card wide-card">
                  <div className="panel-head"><div><p className="eyebrow">Drive Profile</p><h2>Return walk threshold</h2></div></div>
                  <div className="form-grid">
                    <label>Max return walk meters<input value={driveProfile.maxReturnWalkMeters} onChange={(event) => setDriveProfile({ maxReturnWalkMeters: event.target.value })} /></label>
                  </div>
                  <div className="panel-actions"><button type="button" onClick={() => void saveModuleProfile()} disabled={busy}>{busy ? "Saving..." : "Save drive profile"}</button></div>
                </section>
              ) : null}
              {worker.module === "FREECARGO" ? (
                <section className="panel-card wide-card">
                  <div className="panel-head"><div><p className="eyebrow">Cargo Profile</p><h2>Handling capability</h2></div></div>
                  <div className="form-grid">
                    <label className="checkbox-field"><input type="checkbox" checked={cargoProfile.canLoadingHelp} onChange={(event) => setCargoProfile((current) => ({ ...current, canLoadingHelp: event.target.checked }))} />Can loading help</label>
                    <label className="checkbox-field"><input type="checkbox" checked={cargoProfile.hasForklift} onChange={(event) => setCargoProfile((current) => ({ ...current, hasForklift: event.target.checked }))} />Has forklift</label>
                    <label className="full-span">Business registration<input value={cargoProfile.businessRegNo} onChange={(event) => setCargoProfile((current) => ({ ...current, businessRegNo: event.target.value }))} /></label>
                  </div>
                  <div className="panel-actions"><button type="button" onClick={() => void saveModuleProfile()} disabled={busy}>{busy ? "Saving..." : "Save cargo profile"}</button></div>
                </section>
              ) : null}
            </>
          ) : null}

          {view === "earnings" ? (
            <>
              <MetricCard label="Today's earnings" value={formatCurrency(earnings?.totalEarnings ?? 0)} detail="Completed jobs settled today." />
              <MetricCard label="Completed jobs" value={String(earnings?.completedJobs ?? 0)} detail="Worker-completed rides counted in today's window." />
              <section className="panel-card wide-card">
                <div className="panel-head"><div><p className="eyebrow">Summary</p><h2>Earnings and readiness</h2></div></div>
                <div className="detail-stack">
                  <strong>{worker.name}</strong>
                  <p>{worker.module} · {worker.vehicleType} · {worker.status}</p>
                  <span>{worker.isOnline ? "Currently online and visible to dispatch." : "Currently offline and hidden from dispatch."}</span>
                </div>
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </>
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
    default:
      return module;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
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
