import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";
import { InMemoryJobStore } from "../core/jobs/store.js";
import { JobStatus } from "../core/jobs/types.js";
import { createAccessToken } from "../lib/token.js";

const baseConfig = {
  port: 3001,
  host: "0.0.0.0",
  jwtSecret: "super-secret-key",
  databaseUrl: "postgresql://iwootcall:iwootcall@localhost:5432/iwootcall",
  redisUrl: "redis://localhost:6379",
  enabledModules: [ModuleType.FREECAB, ModuleType.FREEDRIVE],
  mapProvider: "osm" as const,
  osrmUrl: "http://localhost:5000",
  tileServerUrl: "http://localhost:8080"
};

describe("admin stats routes", () => {
  it("returns module-level stats for today's jobs and worker state", async () => {
    const jobStore = new InMemoryJobStore();
    const app = buildApp(baseConfig, {
      jobStore
    });

    const workerOneResponse = await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01084000001",
        name: "Cab Worker One",
        module: ModuleType.FREECAB,
        vehicleType: VehicleType.SEDAN,
        vehicleNumber: "84A1001",
        otpCode: "000000"
      }
    });
    const workerTwoResponse = await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01084000002",
        name: "Cab Worker Two",
        module: ModuleType.FREECAB,
        vehicleType: VehicleType.VAN,
        vehicleNumber: "84A1002",
        otpCode: "000000"
      }
    });
    const driveWorkerResponse = await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01084000003",
        name: "Drive Worker",
        module: ModuleType.FREEDRIVE,
        vehicleType: VehicleType.ANY,
        vehicleNumber: "84A1003",
        otpCode: "000000"
      }
    });

    const workerOneId = workerOneResponse.json().worker.id as string;
    const workerTwoId = workerTwoResponse.json().worker.id as string;
    const driveWorkerId = driveWorkerResponse.json().worker.id as string;
    const adminToken = await createAccessToken(
      {
        sub: "admin-1",
        role: "admin",
        phone: "01000000000"
      },
      baseConfig.jwtSecret
    );

    for (const workerId of [workerOneId, workerTwoId, driveWorkerId]) {
      await app.inject({
        method: "PATCH",
        url: `/admin/workers/${workerId}/status`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          status: "ACTIVE"
        }
      });
    }

    const workerOneToken = (
      await app.inject({
        method: "POST",
        url: "/auth/worker/login",
        payload: {
          phone: "01084000001",
          otpCode: "000000"
        }
      })
    ).json().token as string;
    const driveWorkerToken = (
      await app.inject({
        method: "POST",
        url: "/auth/worker/login",
        payload: {
          phone: "01084000003",
          otpCode: "000000"
        }
      })
    ).json().token as string;

    await app.inject({
      method: "PATCH",
      url: "/worker/presence",
      headers: {
        authorization: `Bearer ${workerOneToken}`
      },
      payload: {
        isOnline: true,
        lat: 37.5,
        lng: 127
      }
    });
    await app.inject({
      method: "PATCH",
      url: "/worker/presence",
      headers: {
        authorization: `Bearer ${driveWorkerToken}`
      },
      payload: {
        isOnline: true,
        lat: 37.51,
        lng: 127.02
      }
    });

    const cabCompleted = await jobStore.create({
      customerId: "customer-1",
      module: ModuleType.FREECAB,
      originLat: 37.5,
      originLng: 127,
      originAddress: "A",
      fare: 10000
    });
    await jobStore.update(cabCompleted.id, {
      workerId: workerOneId,
      status: JobStatus.COMPLETED,
      fare: 10000,
      completedAt: new Date().toISOString()
    });

    const drivePending = await jobStore.create({
      customerId: "customer-2",
      module: ModuleType.FREEDRIVE,
      originLat: 37.51,
      originLng: 127.02,
      originAddress: "B",
      estimatedFare: 20000
    });
    await jobStore.update(drivePending.id, {
      workerId: driveWorkerId,
      status: JobStatus.ACCEPTED,
      acceptedAt: new Date().toISOString()
    });

    const historicalCab = await jobStore.create({
      customerId: "customer-3",
      module: ModuleType.FREECAB,
      originLat: 37.49,
      originLng: 127.01,
      originAddress: "C",
      fare: 8000
    });
    await jobStore.update(historicalCab.id, {
      workerId: workerTwoId,
      status: JobStatus.COMPLETED,
      fare: 8000,
      completedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
    });

    const statsResponse = await app.inject({
      method: "GET",
      url: "/admin/stats?range=today",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(statsResponse.statusCode).toBe(200);
    expect(statsResponse.json()).toMatchObject({
      summary: {
        totalJobs: 2,
        completedJobs: 1,
        grossFare: 10000,
        activeWorkers: 3,
        onlineWorkers: 2
      },
      perModule: [
        {
          module: ModuleType.FREECAB,
          totalJobs: 1,
          completedJobs: 1,
          grossFare: 10000,
          activeWorkers: 2,
          onlineWorkers: 1
        },
        {
          module: ModuleType.FREEDRIVE,
          totalJobs: 1,
          completedJobs: 0,
          grossFare: 0,
          activeWorkers: 1,
          onlineWorkers: 1
        }
      ]
    });

    await app.close();
  });
});
