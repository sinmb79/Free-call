import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";

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
    ModuleType.FREESHUTTLE
  ],
  mapProvider: "osm" as const,
  osrmUrl: "http://localhost:5000",
  tileServerUrl: "http://localhost:8080"
};

describe("worker module profile routes", () => {
  it("manages drive and cargo module profiles while rejecting unsupported workers", async () => {
    const app = buildApp(baseConfig);

    await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01085000001",
        name: "Drive Worker",
        module: ModuleType.FREEDRIVE,
        vehicleType: VehicleType.ANY,
        vehicleNumber: "85A1001",
        otpCode: "000000"
      }
    });
    await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01085000002",
        name: "Cargo Worker",
        module: ModuleType.FREECARGO,
        vehicleType: VehicleType.TRUCK_1TON,
        vehicleNumber: "85A1002",
        otpCode: "000000"
      }
    });
    await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01085000003",
        name: "Cab Worker",
        module: ModuleType.FREECAB,
        vehicleType: VehicleType.SEDAN,
        vehicleNumber: "85A1003",
        otpCode: "000000"
      }
    });

    const driveToken = (
      await app.inject({
        method: "POST",
        url: "/auth/worker/login",
        payload: {
          phone: "01085000001",
          otpCode: "000000"
        }
      })
    ).json().token as string;
    const cargoToken = (
      await app.inject({
        method: "POST",
        url: "/auth/worker/login",
        payload: {
          phone: "01085000002",
          otpCode: "000000"
        }
      })
    ).json().token as string;
    const cabToken = (
      await app.inject({
        method: "POST",
        url: "/auth/worker/login",
        payload: {
          phone: "01085000003",
          otpCode: "000000"
        }
      })
    ).json().token as string;

    const driveProfileResponse = await app.inject({
      method: "GET",
      url: "/worker/drive-profile",
      headers: {
        authorization: `Bearer ${driveToken}`
      }
    });
    expect(driveProfileResponse.statusCode).toBe(200);
    expect(driveProfileResponse.json()).toEqual({
      profile: {
        maxReturnWalkMeters: 1500
      }
    });

    const driveUpdateResponse = await app.inject({
      method: "PATCH",
      url: "/worker/drive-profile",
      headers: {
        authorization: `Bearer ${driveToken}`
      },
      payload: {
        maxReturnWalkMeters: 2200
      }
    });
    expect(driveUpdateResponse.statusCode).toBe(200);
    expect(driveUpdateResponse.json()).toEqual({
      profile: {
        maxReturnWalkMeters: 2200
      }
    });

    const cargoProfileResponse = await app.inject({
      method: "GET",
      url: "/worker/cargo-profile",
      headers: {
        authorization: `Bearer ${cargoToken}`
      }
    });
    expect(cargoProfileResponse.statusCode).toBe(200);
    expect(cargoProfileResponse.json()).toEqual({
      profile: {
        canLoadingHelp: false,
        hasForklift: false,
        businessRegNo: null
      }
    });

    const cargoUpdateResponse = await app.inject({
      method: "PATCH",
      url: "/worker/cargo-profile",
      headers: {
        authorization: `Bearer ${cargoToken}`
      },
      payload: {
        canLoadingHelp: true,
        hasForklift: true,
        businessRegNo: "123-45-67890"
      }
    });
    expect(cargoUpdateResponse.statusCode).toBe(200);
    expect(cargoUpdateResponse.json()).toEqual({
      profile: {
        canLoadingHelp: true,
        hasForklift: true,
        businessRegNo: "123-45-67890"
      }
    });

    const unsupportedResponse = await app.inject({
      method: "PATCH",
      url: "/worker/drive-profile",
      headers: {
        authorization: `Bearer ${cabToken}`
      },
      payload: {
        maxReturnWalkMeters: 999
      }
    });
    expect(unsupportedResponse.statusCode).toBe(400);

    await app.close();
  });
});
