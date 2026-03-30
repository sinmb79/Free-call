import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";
import { InMemoryJobStore } from "../core/jobs/store.js";
import { JobStatus } from "../core/jobs/types.js";

const baseConfig = {
  port: 3001,
  host: "0.0.0.0",
  jwtSecret: "super-secret-key",
  databaseUrl: "postgresql://iwootcall:iwootcall@localhost:5432/iwootcall",
  redisUrl: "redis://localhost:6379",
  enabledModules: [
    ModuleType.FREECAB,
    ModuleType.FREEDRIVE,
    ModuleType.FREECARGO,
    ModuleType.FREERUN
  ],
  mapProvider: "osm" as const,
  osrmUrl: "http://localhost:5000",
  tileServerUrl: "http://localhost:8080"
};

describe("worker routes", () => {
  it("returns the worker profile, updates presence, exposes the active job, and summarizes today's earnings", async () => {
    const jobStore = new InMemoryJobStore();
    const app = buildApp(baseConfig, {
      jobStore
    });

    await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01081000001",
        name: "Worker One",
        module: ModuleType.FREECAB,
        vehicleType: VehicleType.SEDAN,
        vehicleNumber: "81A1001",
        otpCode: "000000"
      }
    });
    const workerLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/worker/login",
      payload: {
        phone: "01081000001",
        otpCode: "000000"
      }
    });
    const worker = workerLoginResponse.json().worker as {
      id: string;
      phone: string;
      module: ModuleType;
    };
    const workerToken = workerLoginResponse.json().token as string;

    const activeJob = await jobStore.create({
      customerId: "customer-active",
      module: ModuleType.FREECAB,
      originLat: 37.5,
      originLng: 127,
      originAddress: "Seoul Station",
      destLat: 37.51,
      destLng: 127.01,
      destAddress: "City Hall",
      estimatedFare: 9000
    });
    await jobStore.update(activeJob.id, {
      workerId: worker.id,
      status: JobStatus.ACCEPTED,
      acceptedAt: new Date().toISOString()
    });

    const completedToday = await jobStore.create({
      customerId: "customer-complete-1",
      module: ModuleType.FREECAB,
      originLat: 37.49,
      originLng: 127,
      originAddress: "Gangnam",
      estimatedFare: 11000,
      fare: 11000
    });
    await jobStore.update(completedToday.id, {
      workerId: worker.id,
      status: JobStatus.COMPLETED,
      fare: 11000,
      completedAt: new Date().toISOString()
    });

    const completedYesterday = await jobStore.create({
      customerId: "customer-complete-2",
      module: ModuleType.FREECAB,
      originLat: 37.48,
      originLng: 127,
      originAddress: "Jamsil",
      estimatedFare: 7000,
      fare: 7000
    });
    await jobStore.update(completedYesterday.id, {
      workerId: worker.id,
      status: JobStatus.COMPLETED,
      fare: 7000,
      completedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
    });

    const meResponse = await app.inject({
      method: "GET",
      url: "/worker/me",
      headers: {
        authorization: `Bearer ${workerToken}`
      }
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      worker: {
        id: worker.id,
        phone: worker.phone,
        module: worker.module
      }
    });

    const presenceResponse = await app.inject({
      method: "PATCH",
      url: "/worker/presence",
      headers: {
        authorization: `Bearer ${workerToken}`
      },
      payload: {
        isOnline: true,
        lat: 37.5002,
        lng: 127.0002
      }
    });
    expect(presenceResponse.statusCode).toBe(200);
    expect(presenceResponse.json()).toMatchObject({
      worker: {
        id: worker.id,
        isOnline: true,
        lat: 37.5002,
        lng: 127.0002
      }
    });

    const deviceResponse = await app.inject({
      method: "PATCH",
      url: "/worker/device",
      headers: {
        authorization: `Bearer ${workerToken}`
      },
      payload: {
        fcmToken: "worker-token-1"
      }
    });
    expect(deviceResponse.statusCode).toBe(200);
    expect(deviceResponse.json()).toMatchObject({
      worker: {
        id: worker.id,
        fcmToken: "worker-token-1"
      }
    });

    const activeJobResponse = await app.inject({
      method: "GET",
      url: "/worker/jobs/active",
      headers: {
        authorization: `Bearer ${workerToken}`
      }
    });
    expect(activeJobResponse.statusCode).toBe(200);
    expect(activeJobResponse.json()).toMatchObject({
      job: {
        id: activeJob.id,
        workerId: worker.id,
        status: JobStatus.ACCEPTED
      }
    });

    const earningsResponse = await app.inject({
      method: "GET",
      url: "/worker/earnings/today",
      headers: {
        authorization: `Bearer ${workerToken}`
      }
    });
    expect(earningsResponse.statusCode).toBe(200);
    expect(earningsResponse.json()).toEqual({
      summary: {
        totalEarnings: 11000,
        completedJobs: 1
      }
    });

    await app.close();
  });
});
