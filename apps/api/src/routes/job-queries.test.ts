import { describe, expect, it } from "vitest";
import { ModuleType } from "@iwootcall/shared";
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

describe("job query routes", () => {
  it("scopes customer job reads and lets admins filter jobs", async () => {
    const jobStore = new InMemoryJobStore();
    const app = buildApp(baseConfig, {
      jobStore
    });

    const firstRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01082000001",
        name: "Customer One",
        otpCode: "000000"
      }
    });
    const firstCustomerId = firstRegisterResponse.json().customer.id as string;
    const firstLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/login",
      payload: {
        phone: "01082000001",
        otpCode: "000000"
      }
    });
    const firstCustomerToken = firstLoginResponse.json().token as string;

    const secondRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01082000002",
        name: "Customer Two",
        otpCode: "000000"
      }
    });
    const secondCustomerId = secondRegisterResponse.json().customer.id as string;

    const firstJob = await jobStore.create({
      customerId: firstCustomerId,
      module: ModuleType.FREECAB,
      originLat: 37.5,
      originLng: 127,
      originAddress: "Seoul Station",
      estimatedFare: 9000
    });
    await jobStore.update(firstJob.id, {
      status: JobStatus.ACCEPTED,
      workerId: "worker-1",
      acceptedAt: new Date().toISOString()
    });

    const secondJob = await jobStore.create({
      customerId: firstCustomerId,
      module: ModuleType.FREEDRIVE,
      originLat: 37.51,
      originLng: 127.02,
      originAddress: "Mapo",
      estimatedFare: 20000
    });
    await jobStore.update(secondJob.id, {
      status: JobStatus.PENDING
    });

    const otherCustomerJob = await jobStore.create({
      customerId: secondCustomerId,
      module: ModuleType.FREECAB,
      originLat: 37.45,
      originLng: 127.03,
      originAddress: "Songpa",
      estimatedFare: 7000
    });
    await jobStore.update(otherCustomerJob.id, {
      status: JobStatus.COMPLETED,
      fare: 7000,
      workerId: "worker-2",
      completedAt: new Date().toISOString()
    });

    const customerListResponse = await app.inject({
      method: "GET",
      url: "/customer/jobs",
      headers: {
        authorization: `Bearer ${firstCustomerToken}`
      }
    });
    expect(customerListResponse.statusCode).toBe(200);
    expect(customerListResponse.json().jobs).toHaveLength(2);
    expect(
      customerListResponse.json().jobs.every(
        (job: { customerId: string }) => job.customerId === firstCustomerId
      )
    ).toBe(true);

    const customerDetailResponse = await app.inject({
      method: "GET",
      url: `/customer/jobs/${firstJob.id}`,
      headers: {
        authorization: `Bearer ${firstCustomerToken}`
      }
    });
    expect(customerDetailResponse.statusCode).toBe(200);
    expect(customerDetailResponse.json()).toMatchObject({
      job: {
        id: firstJob.id,
        customerId: firstCustomerId
      }
    });

    const customerForbiddenDetailResponse = await app.inject({
      method: "GET",
      url: `/customer/jobs/${otherCustomerJob.id}`,
      headers: {
        authorization: `Bearer ${firstCustomerToken}`
      }
    });
    expect(customerForbiddenDetailResponse.statusCode).toBe(404);

    const adminToken = await createAccessToken(
      {
        sub: "admin-1",
        role: "admin",
        phone: "01000000000"
      },
      baseConfig.jwtSecret
    );
    const adminJobsResponse = await app.inject({
      method: "GET",
      url: "/admin/jobs?status=COMPLETED&module=FREECAB",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    expect(adminJobsResponse.statusCode).toBe(200);
    expect(adminJobsResponse.json()).toMatchObject({
      jobs: [
        {
          id: otherCustomerJob.id,
          module: ModuleType.FREECAB,
          status: JobStatus.COMPLETED
        }
      ]
    });
    expect(adminJobsResponse.json().jobs).toHaveLength(1);

    await app.close();
  });
});
