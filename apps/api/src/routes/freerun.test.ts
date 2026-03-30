import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";

const baseConfig = {
  port: 3001,
  host: "0.0.0.0",
  jwtSecret: "super-secret-key",
  databaseUrl: "postgresql://iwootcall:iwootcall@localhost:5432/iwootcall",
  redisUrl: "redis://localhost:6379",
  enabledModules: [ModuleType.FREERUN, ModuleType.FREECAB],
  mapProvider: "osm" as const,
  osrmUrl: "http://localhost:5000",
  tileServerUrl: "http://localhost:8080"
};

describe("FreeRun batch route", () => {
  it("creates a multi-stop FreeRun job with optimized stops", async () => {
    const app = buildApp(baseConfig);

    await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01087000001",
        name: "Store Owner",
        otpCode: "000000"
      }
    });
    const customerToken = (
      await app.inject({
        method: "POST",
        url: "/auth/customer/login",
        payload: {
          phone: "01087000001",
          otpCode: "000000"
        }
      })
    ).json().token as string;

    const response = await app.inject({
      method: "POST",
      url: "/freerun/batch",
      headers: {
        authorization: `Bearer ${customerToken}`
      },
      payload: {
        originLat: 37.5,
        originLng: 127,
        originAddress: "Store",
        vehicleType: VehicleType.MOTORCYCLE,
        stops: [
          {
            lat: 37.503,
            lng: 127.003,
            address: "Stop C",
            recipientPhone: "01000000003",
            itemDesc: "Third"
          },
          {
            lat: 37.5005,
            lng: 127.0005,
            address: "Stop A",
            recipientPhone: "01000000001",
            itemDesc: "First"
          },
          {
            lat: 37.5015,
            lng: 127.0015,
            address: "Stop B",
            recipientPhone: "01000000002",
            itemDesc: "Second"
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      job: {
        module: ModuleType.FREERUN,
        status: "NO_WORKER",
        originAddress: "Store",
        destAddress: "Stop C",
        estimatedFare: expect.any(Number),
        metadata: {
          vehicleType: VehicleType.MOTORCYCLE,
          stops: [
            {
              seq: 1,
              address: "Stop A"
            },
            {
              seq: 2,
              address: "Stop B"
            },
            {
              seq: 3,
              address: "Stop C"
            }
          ]
        }
      }
    });
    expect(response.json().job.estimatedKm).toBeGreaterThan(0);

    await app.close();
  });
});
