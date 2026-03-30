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

describe("customer profile routes", () => {
  it("supports profile updates and favorite place CRUD scoped to the customer", async () => {
    const app = buildApp(baseConfig);

    await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01083000001",
        name: "Primary Customer",
        otpCode: "000000"
      }
    });
    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/login",
      payload: {
        phone: "01083000001",
        otpCode: "000000"
      }
    });
    const token = loginResponse.json().token as string;

    await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01083000002",
        name: "Other Customer",
        otpCode: "000000"
      }
    });
    const otherLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/login",
      payload: {
        phone: "01083000002",
        otpCode: "000000"
      }
    });
    const otherToken = otherLoginResponse.json().token as string;

    const meResponse = await app.inject({
      method: "GET",
      url: "/customer/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toMatchObject({
      customer: {
        name: "Primary Customer",
        elderlyMode: false
      }
    });

    const patchMeResponse = await app.inject({
      method: "PATCH",
      url: "/customer/me",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: "Updated Customer",
        elderlyMode: true
      }
    });
    expect(patchMeResponse.statusCode).toBe(200);
    expect(patchMeResponse.json()).toMatchObject({
      customer: {
        name: "Updated Customer",
        elderlyMode: true
      }
    });

    const deviceResponse = await app.inject({
      method: "PATCH",
      url: "/customer/device",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        fcmToken: "customer-token-1"
      }
    });
    expect(deviceResponse.statusCode).toBe(200);
    expect(deviceResponse.json()).toMatchObject({
      customer: {
        fcmToken: "customer-token-1"
      }
    });

    const createFavoriteResponse = await app.inject({
      method: "POST",
      url: "/customer/favorites",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        label: "Home",
        lat: 37.5,
        lng: 127,
        address: "Seoul Station"
      }
    });
    expect(createFavoriteResponse.statusCode).toBe(201);
    expect(createFavoriteResponse.json()).toMatchObject({
      favorite: {
        label: "Home",
        address: "Seoul Station"
      }
    });
    const favoriteId = createFavoriteResponse.json().favorite.id as string;

    const listFavoritesResponse = await app.inject({
      method: "GET",
      url: "/customer/favorites",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    expect(listFavoritesResponse.statusCode).toBe(200);
    expect(listFavoritesResponse.json().favorites).toHaveLength(1);

    const patchFavoriteResponse = await app.inject({
      method: "PATCH",
      url: `/customer/favorites/${favoriteId}`,
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        label: "Office"
      }
    });
    expect(patchFavoriteResponse.statusCode).toBe(200);
    expect(patchFavoriteResponse.json()).toMatchObject({
      favorite: {
        id: favoriteId,
        label: "Office"
      }
    });

    const forbiddenPatchResponse = await app.inject({
      method: "PATCH",
      url: `/customer/favorites/${favoriteId}`,
      headers: {
        authorization: `Bearer ${otherToken}`
      },
      payload: {
        label: "Hijacked"
      }
    });
    expect(forbiddenPatchResponse.statusCode).toBe(404);

    const deleteFavoriteResponse = await app.inject({
      method: "DELETE",
      url: `/customer/favorites/${favoriteId}`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    expect(deleteFavoriteResponse.statusCode).toBe(204);

    await app.close();
  });
});
