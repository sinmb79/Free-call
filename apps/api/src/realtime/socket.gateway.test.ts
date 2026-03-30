import { describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { buildApp } from "../app.js";
import { InMemoryWorkerStore } from "../core/auth/store.js";
import { createAccessToken } from "../lib/token.js";

const baseConfig = {
  port: 3001,
  host: "127.0.0.1",
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

describe("Socket gateway", () => {
  it("emits incoming calls only to the assigned worker and relays location updates to customer and admin rooms", async () => {
    const workerStore = new InMemoryWorkerStore();
    const app = buildApp(baseConfig, {
      workerStore
    });

    const customerRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/register",
      payload: {
        phone: "01071000001",
        name: "Passenger",
        otpCode: "000000"
      }
    });
    const customerId = customerRegisterResponse.json().customer.id as string;
    const customerLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/customer/login",
      payload: {
        phone: "01071000001",
        otpCode: "000000"
      }
    });
    const customerToken = customerLoginResponse.json().token as string;

    await app.inject({
      method: "POST",
      url: "/auth/worker/register",
      payload: {
        phone: "01071000002",
        name: "Realtime Driver",
        module: ModuleType.FREECAB,
        vehicleType: VehicleType.SEDAN,
        vehicleNumber: "71A1002",
        otpCode: "000000"
      }
    });
    const workerLoginResponse = await app.inject({
      method: "POST",
      url: "/auth/worker/login",
      payload: {
        phone: "01071000002",
        otpCode: "000000"
      }
    });
    const workerId = workerLoginResponse.json().worker.id as string;
    const workerToken = workerLoginResponse.json().token as string;
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

    await app.listen({
      port: 0,
      host: "127.0.0.1"
    });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP address");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const workerSocket = createSocketClient(baseUrl, workerToken);
    const customerSocket = createSocketClient(baseUrl, customerToken);
    const adminSocket = createSocketClient(baseUrl, adminToken);

    await Promise.all([
      waitForSocketEvent(workerSocket, "connect"),
      waitForSocketEvent(customerSocket, "connect"),
      waitForSocketEvent(adminSocket, "connect")
    ]);

    let customerIncomingCall = false;
    let adminIncomingCall = false;
    customerSocket.on("call:incoming", () => {
      customerIncomingCall = true;
    });
    adminSocket.on("call:incoming", () => {
      adminIncomingCall = true;
    });

    const incomingCallPromise = waitForSocketEvent(workerSocket, "call:incoming");
    const assignedPromise = waitForSocketEvent(customerSocket, "worker:assigned");
    const customerLocationPromise = waitForSocketEvent(
      customerSocket,
      "worker:location"
    );
    const adminLocationPromise = waitForSocketEvent(adminSocket, "worker:location");

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
        originAddress: "Seoul Station",
        destLat: 37.5005,
        destLng: 127.001,
        destAddress: "City Hall",
        metadata: {
          vehicleType: VehicleType.SEDAN
        }
      }
    });
    const jobId = createJobResponse.json().job.id as string;

    const [incomingPayload] = await incomingCallPromise;
    expect(incomingPayload).toMatchObject({
      jobId,
      workerId
    });

    await delay(50);
    expect(customerIncomingCall).toBe(false);
    expect(adminIncomingCall).toBe(false);

    workerSocket.emit("worker:call:accept", {
      jobId
    });

    const [assignedPayload] = await assignedPromise;
    expect(assignedPayload).toMatchObject({
      jobId,
      customerId,
      workerId
    });

    workerSocket.emit("worker:location:update", {
      lat: 37.5002,
      lng: 127.0002
    });

    const [customerLocation] = await customerLocationPromise;
    const [adminLocation] = await adminLocationPromise;
    expect(customerLocation).toMatchObject({
      jobId,
      workerId,
      lat: 37.5002,
      lng: 127.0002
    });
    expect(adminLocation).toMatchObject({
      jobId,
      workerId,
      lat: 37.5002,
      lng: 127.0002
    });

    workerSocket.close();
    customerSocket.close();
    adminSocket.close();
    await app.close();
  });
});

function createSocketClient(baseUrl: string, token: string): Socket {
  return io(baseUrl, {
    transports: ["websocket"],
    auth: {
      token
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitForSocketEvent(
  socket: Socket,
  eventName: string,
  timeoutMs = 5000
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for socket event: ${eventName}`));
    }, timeoutMs);
    const onEvent = (...args: unknown[]) => {
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
      resolve(args);
    };

    socket.once(eventName, onEvent);
  });
}
