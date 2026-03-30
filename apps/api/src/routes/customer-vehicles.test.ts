import { describe, expect, it } from "vitest";
import { ModuleType } from "@iwootcall/shared";
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
    ModuleType.FREERUN
  ],
  mapProvider: "osm" as const,
  osrmUrl: "http://localhost:5000",
  tileServerUrl: "http://localhost:8080"
};

describe("customer vehicle routes", () => {
  it("supports vehicle CRUD for the owning customer only", async () => {
    const app = buildApp(baseConfig);

    await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01010000001",
        name: "Owner",
        otpCode: "000000"
      }
    });
    const ownerLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/login",
      payload: {
        phone: "01010000001",
        otpCode: "000000"
      }
    });
    const ownerToken = ownerLoginResponse.json().token as string;

    await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01010000002",
        name: "Other",
        otpCode: "000000"
      }
    });
    const otherLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/login",
      payload: {
        phone: "01010000002",
        otpCode: "000000"
      }
    });
    const otherToken = otherLoginResponse.json().token as string;

    const createResponse = await app.inject({
      method: "POST",
      url: "/customer/vehicles",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        label: "집차",
        carNumber: "12가3456",
        carModel: "Sonata",
        isDefault: true
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      vehicle: {
        label: "집차",
        carNumber: "12가3456",
        isDefault: true
      }
    });
    const vehicleId = createResponse.json().vehicle.id as string;

    const listResponse = await app.inject({
      method: "GET",
      url: "/customer/vehicles",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().vehicles).toHaveLength(1);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: `/customer/vehicles/${vehicleId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        label: "회사차",
        isDefault: false
      }
    });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toMatchObject({
      vehicle: {
        id: vehicleId,
        label: "회사차",
        isDefault: false
      }
    });

    const forbiddenPatchResponse = await app.inject({
      method: "PATCH",
      url: `/customer/vehicles/${vehicleId}`,
      headers: {
        authorization: `Bearer ${otherToken}`
      },
      payload: {
        label: "침범"
      }
    });

    expect(forbiddenPatchResponse.statusCode).toBe(404);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/customer/vehicles/${vehicleId}`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(deleteResponse.statusCode).toBe(204);

    const finalListResponse = await app.inject({
      method: "GET",
      url: "/customer/vehicles",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(finalListResponse.statusCode).toBe(200);
    expect(finalListResponse.json().vehicles).toHaveLength(0);

    await app.close();
  });
});
