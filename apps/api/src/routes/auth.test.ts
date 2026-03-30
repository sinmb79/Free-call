import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";
import { verifyAccessToken } from "../lib/token.js";

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

describe("auth routes", () => {
  it("registers and logs in a worker", async () => {
    const app = buildApp(baseConfig);

    const registerResponse = await app.inject({
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

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.json()).toMatchObject({
      worker: {
        phone: "01012345678",
        name: "Kim Driver",
        module: ModuleType.FREECAB,
        vehicleType: VehicleType.SEDAN,
        vehicleNumber: "12가3456",
        status: "PENDING"
      }
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/worker/login",
      payload: {
        phone: "01012345678",
        otpCode: "000000"
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toMatchObject({
      token: expect.any(String),
      worker: {
        phone: "01012345678",
        module: ModuleType.FREECAB
      }
    });
    const claims = await verifyAccessToken(
      loginResponse.json().token as string,
      baseConfig.jwtSecret
    );
    expect(claims.module).toBe(ModuleType.FREECAB);
    expect(claims.role).toBe("worker");

    await app.close();
  });

  it("registers and logs in a customer", async () => {
    const app = buildApp(baseConfig);

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01099998888",
        name: "Lee Customer",
        otpCode: "000000"
      }
    });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.json()).toMatchObject({
      customer: {
        phone: "01099998888",
        name: "Lee Customer",
        elderlyMode: false
      }
    });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/login",
      payload: {
        phone: "01099998888",
        otpCode: "000000"
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toMatchObject({
      token: expect.any(String),
      customer: {
        phone: "01099998888"
      }
    });

    await app.close();
  });
});
