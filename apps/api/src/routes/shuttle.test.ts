import { describe, expect, it } from "vitest";
import { ModuleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";
import { createAccessToken } from "../lib/token.js";

const baseConfig = {
  port: 3001,
  host: "0.0.0.0",
  jwtSecret: "super-secret-key",
  databaseUrl: "postgresql://iwootcall:iwootcall@localhost:5432/iwootcall",
  redisUrl: "redis://localhost:6379",
  enabledModules: [ModuleType.FREESHUTTLE, ModuleType.FREECAB],
  mapProvider: "osm" as const,
  osrmUrl: "http://localhost:5000",
  tileServerUrl: "http://localhost:8080"
};

describe("shuttle module routes", () => {
  it("lets admins manage shuttle routes and schedules and lets customers book seats", async () => {
    const app = buildApp(baseConfig);
    const adminToken = await createAccessToken(
      {
        sub: "admin-1",
        role: "admin",
        phone: "01000000000"
      },
      baseConfig.jwtSecret
    );

    const createRouteResponse = await app.inject({
      method: "POST",
      url: "/admin/shuttle/routes",
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        name: "Yangju Morning Loop",
        regionCode: "KR-41630",
        waypoints: [
          { lat: 37.79, lng: 127.04, label: "Village Hall" },
          { lat: 37.8, lng: 127.05, label: "Health Center" }
        ]
      }
    });
    expect(createRouteResponse.statusCode).toBe(201);
    expect(createRouteResponse.json()).toMatchObject({
      route: {
        name: "Yangju Morning Loop",
        isActive: true
      }
    });
    const routeId = createRouteResponse.json().route.id as string;

    const listRoutesResponse = await app.inject({
      method: "GET",
      url: "/admin/shuttle/routes",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    expect(listRoutesResponse.statusCode).toBe(200);
    expect(listRoutesResponse.json().routes).toHaveLength(1);

    const patchRouteResponse = await app.inject({
      method: "PATCH",
      url: `/admin/shuttle/routes/${routeId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        name: "Yangju Loop Updated"
      }
    });
    expect(patchRouteResponse.statusCode).toBe(200);
    expect(patchRouteResponse.json()).toMatchObject({
      route: {
        id: routeId,
        name: "Yangju Loop Updated"
      }
    });

    const createScheduleResponse = await app.inject({
      method: "POST",
      url: "/admin/shuttle/schedules",
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        routeId,
        departure: "2026-04-01T10:00:00.000Z",
        seats: 1
      }
    });
    expect(createScheduleResponse.statusCode).toBe(201);
    expect(createScheduleResponse.json()).toMatchObject({
      schedule: {
        routeId,
        seats: 1,
        bookedSeats: 0
      }
    });
    const scheduleId = createScheduleResponse.json().schedule.id as string;

    const listSchedulesResponse = await app.inject({
      method: "GET",
      url: `/admin/shuttle/schedules?routeId=${routeId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    expect(listSchedulesResponse.statusCode).toBe(200);
    expect(listSchedulesResponse.json().schedules).toHaveLength(1);

    await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01086000001",
        name: "Shuttle Customer",
        otpCode: "000000"
      }
    });
    const customerToken = (
      await app.inject({
        method: "POST",
        url: "/auth/customer/login",
        payload: {
          phone: "01086000001",
          otpCode: "000000"
        }
      })
    ).json().token as string;

    const customerRoutesResponse = await app.inject({
      method: "GET",
      url: "/customer/shuttle/routes",
      headers: {
        authorization: `Bearer ${customerToken}`
      }
    });
    expect(customerRoutesResponse.statusCode).toBe(200);
    expect(customerRoutesResponse.json().routes).toHaveLength(1);

    const bookingResponse = await app.inject({
      method: "POST",
      url: "/customer/shuttle/bookings",
      headers: {
        authorization: `Bearer ${customerToken}`
      },
      payload: {
        routeId,
        scheduleId,
        originLat: 37.79,
        originLng: 127.04,
        originAddress: "Village Hall"
      }
    });
    expect(bookingResponse.statusCode).toBe(201);
    expect(bookingResponse.json()).toMatchObject({
      job: {
        module: ModuleType.FREESHUTTLE,
        originAddress: "Village Hall"
      },
      schedule: {
        id: scheduleId,
        bookedSeats: 1
      }
    });

    const fullBookingResponse = await app.inject({
      method: "POST",
      url: "/customer/shuttle/bookings",
      headers: {
        authorization: `Bearer ${customerToken}`
      },
      payload: {
        routeId,
        scheduleId,
        originLat: 37.79,
        originLng: 127.04,
        originAddress: "Village Hall"
      }
    });
    expect(fullBookingResponse.statusCode).toBe(409);

    const bookedScheduleResponse = await app.inject({
      method: "GET",
      url: `/admin/shuttle/schedules?routeId=${routeId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    expect(bookedScheduleResponse.statusCode).toBe(200);
    expect(bookedScheduleResponse.json()).toMatchObject({
      schedules: [
        {
          id: scheduleId,
          bookedSeats: 1
        }
      ]
    });

    await app.close();
  });
});
