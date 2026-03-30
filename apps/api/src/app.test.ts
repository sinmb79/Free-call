import { describe, expect, it } from "vitest";
import { ModuleType } from "@iwootcall/shared";
import { buildApp } from "./app.js";

describe("buildApp", () => {
  it("returns health status with enabled modules", async () => {
    const app = buildApp({
      port: 3001,
      host: "0.0.0.0",
      jwtSecret: "super-secret-key",
      databaseUrl: "postgresql://iwootcall:iwootcall@localhost:5432/iwootcall",
      redisUrl: "redis://localhost:6379",
      enabledModules: [ModuleType.FREECAB, ModuleType.FREEDRIVE],
      mapProvider: "osm",
      osrmUrl: "http://localhost:5000",
      tileServerUrl: "http://localhost:8080"
    });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "iwootcall-api",
      enabledModules: [ModuleType.FREECAB, ModuleType.FREEDRIVE]
    });

    await app.close();
  });
});
