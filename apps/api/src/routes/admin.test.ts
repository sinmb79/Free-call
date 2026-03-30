import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";
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

describe("admin routes", () => {
  it("lists workers, filters by module and status, and updates worker status", async () => {
    const app = buildApp(baseConfig);

    const firstRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01012345678",
        name: "Kim Driver",
        module: ModuleType.FREECAB,
        vehicleType: VehicleType.SEDAN,
        vehicleNumber: "12가3456",
        otpCode: "000000"
      }
    });
    await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01087654321",
        name: "Han Driver",
        module: ModuleType.FREEDRIVE,
        vehicleType: VehicleType.ANY,
        vehicleNumber: "77나8888",
        otpCode: "000000"
      }
    });

    const workerId = firstRegisterResponse.json().worker.id as string;
    const adminToken = await createAccessToken(
      {
        sub: "admin-1",
        role: "admin",
        phone: "01000000000"
      },
      baseConfig.jwtSecret
    );

    const listResponse = await app.inject({
      method: "GET",
      url: "/admin/workers",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().workers).toHaveLength(2);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/admin/workers/${workerId}/status`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        status: "ACTIVE"
      }
    });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      worker: {
        id: workerId,
        status: "ACTIVE"
      }
    });

    const filteredListResponse = await app.inject({
      method: "GET",
      url: "/admin/workers?module=FREECAB&status=ACTIVE",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(filteredListResponse.statusCode).toBe(200);
    expect(filteredListResponse.json()).toMatchObject({
      workers: [
        {
          id: workerId,
          module: ModuleType.FREECAB,
          status: "ACTIVE"
        }
      ]
    });
    expect(filteredListResponse.json().workers).toHaveLength(1);

    await app.close();
  });
});
