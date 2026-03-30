import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";
import { InMemoryWorkerStore } from "../core/auth/store.js";
import { createAccessToken } from "../lib/token.js";

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

describe("job routes", () => {
  it("creates a job for a customer and queues dispatch", async () => {
    const workerStore = new InMemoryWorkerStore();
    const app = buildApp(baseConfig, {
      workerStore
    });

    const customerRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01030000001",
        name: "Passenger",
        otpCode: "000000"
      }
    });
    const customerId = customerRegisterResponse.json().customer.id as string;
    const customerLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/login",
      payload: {
        phone: "01030000001",
        otpCode: "000000"
      }
    });
    const customerToken = customerLoginResponse.json().token as string;

    await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01030000002",
        name: "Cab Driver",
        module: ModuleType.FREECAB,
        vehicleType: VehicleType.SEDAN,
        vehicleNumber: "11가1111",
        otpCode: "000000"
      }
    });
    const workerLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/worker/login",
      payload: {
        phone: "01030000002",
        otpCode: "000000"
      }
    });
    const workerId = workerLoginResponse.json().worker.id as string;
    const adminToken = await createAccessToken(
      {
        sub: "admin-1",
        role: "admin",
        phone: "01000000000"
      },
      baseConfig.jwtSecret
    );

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
    await workerStore.updatePresence(workerId, {
      isOnline: true,
      lat: 37.5001,
      lng: 127.0001
    });

    const createJobResponse = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: {
        authorization: `Bearer ${customerToken}`
      },
      payload: {
        module: ModuleType.FREECAB,
        originLat: 37.5,
        originLng: 127,
        originAddress: "서울역",
        destLat: 37.5005,
        destLng: 127.001,
        destAddress: "시청",
        metadata: {
          vehicleType: VehicleType.SEDAN
        }
      }
    });

    expect(createJobResponse.statusCode).toBe(201);
    expect(createJobResponse.json()).toMatchObject({
      job: {
        customerId,
        module: ModuleType.FREECAB,
        status: "DISPATCHED",
        workerId,
        estimatedFare: expect.any(Number)
      }
    });

    await app.close();
  });
});
