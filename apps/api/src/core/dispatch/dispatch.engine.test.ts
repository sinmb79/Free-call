import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { InMemoryWorkerStore } from "../auth/store.js";
import { InMemoryJobStore } from "../jobs/store.js";
import { JobStatus } from "../jobs/types.js";
import { DispatchEngine } from "./dispatch.engine.js";

describe("DispatchEngine.findNearbyWorkers", () => {
  it("filters by module and vehicle type, then sorts by distance", async () => {
    const workerStore = new InMemoryWorkerStore();
    const nearCabWorker = await workerStore.create({
      phone: "01050000001",
      name: "Near Cab",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.SEDAN,
      vehicleNumber: "10A1000",
      otpCode: "000000"
    });
    const farCabWorker = await workerStore.create({
      phone: "01050000002",
      name: "Far Cab",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.VAN,
      vehicleNumber: "20A2000",
      otpCode: "000000"
    });
    const driveWorker = await workerStore.create({
      phone: "01050000003",
      name: "Drive Worker",
      module: ModuleType.FREEDRIVE,
      vehicleType: VehicleType.ANY,
      vehicleNumber: "30A3000",
      otpCode: "000000"
    });
    const offlineWorker = await workerStore.create({
      phone: "01050000004",
      name: "Offline Worker",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.SEDAN,
      vehicleNumber: "40A4000",
      otpCode: "000000"
    });
    const pendingWorker = await workerStore.create({
      phone: "01050000005",
      name: "Pending Worker",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.SEDAN,
      vehicleNumber: "50A5000",
      otpCode: "000000"
    });

    await workerStore.updateStatus(nearCabWorker.id, "ACTIVE");
    await workerStore.updateStatus(farCabWorker.id, "ACTIVE");
    await workerStore.updateStatus(driveWorker.id, "ACTIVE");
    await workerStore.updateStatus(offlineWorker.id, "ACTIVE");
    await workerStore.updateStatus(pendingWorker.id, "PENDING");
    await workerStore.updatePresence(nearCabWorker.id, {
      isOnline: true,
      lat: 37.5005,
      lng: 127.0005
    });
    await workerStore.updatePresence(farCabWorker.id, {
      isOnline: true,
      lat: 37.52,
      lng: 127.02
    });
    await workerStore.updatePresence(driveWorker.id, {
      isOnline: true,
      lat: 37.5004,
      lng: 127.0004
    });
    await workerStore.updatePresence(offlineWorker.id, {
      isOnline: false,
      lat: 37.5001,
      lng: 127.0001
    });
    await workerStore.updatePresence(pendingWorker.id, {
      isOnline: true,
      lat: 37.50001,
      lng: 127.00001
    });

    const engine = new DispatchEngine(workerStore, new InMemoryJobStore(), {
      emitIncomingCall() {},
      emitDispatchFailed() {}
    });

    const candidates = await engine.findNearbyWorkers(
      ModuleType.FREECAB,
      37.5,
      127,
      3000,
      [VehicleType.SEDAN]
    );

    expect(candidates).toEqual([
      expect.objectContaining({
        workerId: nearCabWorker.id
      })
    ]);
    expect(candidates[0].distanceMeters).toBeLessThan(100);
  });
});

describe("DispatchEngine.dispatchJob", () => {
  it("assigns the nearest active worker and emits an incoming call", async () => {
    const workerStore = new InMemoryWorkerStore();
    const worker = await workerStore.create({
      phone: "01040000001",
      name: "Nearest Driver",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.SEDAN,
      vehicleNumber: "12A3456",
      otpCode: "000000"
    });
    await workerStore.updateStatus(worker.id, "ACTIVE");
    await workerStore.updatePresence(worker.id, {
      isOnline: true,
      lat: 37.5003,
      lng: 127.0003
    });

    const jobStore = new InMemoryJobStore();
    const job = await jobStore.create({
      customerId: "customer-1",
      module: ModuleType.FREECAB,
      originLat: 37.5,
      originLng: 127,
      originAddress: "Seoul Station",
      destLat: 37.501,
      destLng: 127.002,
      destAddress: "City Hall",
      estimatedFare: 5000,
      metadata: {
        vehicleType: VehicleType.SEDAN
      }
    });

    const events: string[] = [];
    const engine = new DispatchEngine(workerStore, jobStore, {
      emitIncomingCall(workerId, dispatchedJob) {
        events.push(`incoming:${workerId}:${dispatchedJob.id}`);
      },
      emitDispatchFailed() {
        events.push("failed");
      }
    });

    const assignedWorkerId = await engine.dispatchJob(job.id);
    const updatedJob = await jobStore.findById(job.id);

    expect(assignedWorkerId).toBe(worker.id);
    expect(updatedJob?.status).toBe(JobStatus.DISPATCHED);
    expect(updatedJob?.workerId).toBe(worker.id);
    expect(events).toContain(`incoming:${worker.id}:${job.id}`);
  });

  it("reassigns on timeout and marks the job as failed after retries are exhausted", async () => {
    const workerStore = new InMemoryWorkerStore();
    const firstWorker = await workerStore.create({
      phone: "01040000002",
      name: "First Driver",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.SEDAN,
      vehicleNumber: "22A2222",
      otpCode: "000000"
    });
    const secondWorker = await workerStore.create({
      phone: "01040000003",
      name: "Second Driver",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.SEDAN,
      vehicleNumber: "33A3333",
      otpCode: "000000"
    });

    await workerStore.updateStatus(firstWorker.id, "ACTIVE");
    await workerStore.updateStatus(secondWorker.id, "ACTIVE");
    await workerStore.updatePresence(firstWorker.id, {
      isOnline: true,
      lat: 37.5001,
      lng: 127.0001
    });
    await workerStore.updatePresence(secondWorker.id, {
      isOnline: true,
      lat: 37.5004,
      lng: 127.0004
    });

    const jobStore = new InMemoryJobStore();
    const job = await jobStore.create({
      customerId: "customer-2",
      module: ModuleType.FREECAB,
      originLat: 37.5,
      originLng: 127,
      originAddress: "Seoul Station",
      destLat: 37.501,
      destLng: 127.002,
      destAddress: "City Hall",
      estimatedFare: 5000,
      metadata: {
        vehicleType: VehicleType.SEDAN
      }
    });

    const events: string[] = [];
    const engine = new DispatchEngine(workerStore, jobStore, {
      emitIncomingCall(workerId, dispatchedJob) {
        events.push(`incoming:${workerId}:${dispatchedJob.id}`);
      },
      emitDispatchFailed(failedJob) {
        events.push(`failed:${failedJob.id}`);
      }
    });

    await engine.dispatchJob(job.id);
    await engine.onWorkerTimeout(job.id, firstWorker.id);
    const reassignedJob = await jobStore.findById(job.id);

    expect(reassignedJob?.workerId).toBe(secondWorker.id);
    expect(events).toContain(`incoming:${secondWorker.id}:${job.id}`);

    await engine.onWorkerTimeout(job.id, secondWorker.id);
    const failedJob = await jobStore.findById(job.id);

    expect(failedJob?.status).toBe(JobStatus.NO_WORKER);
    expect(events).toContain(`failed:${job.id}`);
  });
});

describe("DispatchEngine.estimateFare", () => {
  it("returns module-aware fare estimates", () => {
    const engine = new DispatchEngine(
      new InMemoryWorkerStore(),
      new InMemoryJobStore(),
      {
        emitIncomingCall() {},
        emitDispatchFailed() {}
      }
    );

    expect(engine.estimateFare(ModuleType.FREECAB, 1500, 300)).toBeGreaterThan(0);
    expect(engine.estimateFare(ModuleType.FREEDRIVE, 4000, 0)).toBe(15000);
    expect(
      engine.estimateFare(ModuleType.FREECARGO, 5000, 0, {
        vehicleType: VehicleType.TRUCK_1TON
      })
    ).toBe(30000);
    expect(engine.estimateFare(ModuleType.FREERUN, 3000, 0)).toBe(8000);
  });
});
