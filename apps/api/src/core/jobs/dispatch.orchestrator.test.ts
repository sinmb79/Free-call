import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import { InMemoryWorkerStore } from "../auth/store.js";
import { DispatchEngine } from "../dispatch/dispatch.engine.js";
import { InMemoryJobStore } from "./store.js";
import { DispatchOrchestrator, type DispatchQueue } from "./queue.js";

describe("DispatchOrchestrator", () => {
  it("schedules worker response timeouts after dispatch and reassignment", async () => {
    const workerStore = new InMemoryWorkerStore();
    const firstWorker = await workerStore.create({
      phone: "01061000001",
      name: "First Worker",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.SEDAN,
      vehicleNumber: "61A1001",
      otpCode: "000000"
    });
    const secondWorker = await workerStore.create({
      phone: "01061000002",
      name: "Second Worker",
      module: ModuleType.FREECAB,
      vehicleType: VehicleType.SEDAN,
      vehicleNumber: "61A1002",
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
      lat: 37.5005,
      lng: 127.0005
    });

    const jobStore = new InMemoryJobStore();
    const job = await jobStore.create({
      customerId: "customer-6101",
      module: ModuleType.FREECAB,
      originLat: 37.5,
      originLng: 127,
      originAddress: "Seoul Station",
      destLat: 37.501,
      destLng: 127.002,
      destAddress: "City Hall",
      metadata: {
        vehicleType: VehicleType.SEDAN
      }
    });

    const scheduledTimeouts: Array<{ jobId: string; workerId: string }> = [];
    const queue: DispatchQueue = {
      enqueue: async () => {},
      scheduleWorkerTimeout: async (jobId, workerId) => {
        scheduledTimeouts.push({ jobId, workerId });
      }
    };
    const engine = new DispatchEngine(workerStore, jobStore, {
      emitIncomingCall() {},
      emitDispatchFailed() {}
    });
    const orchestrator = new DispatchOrchestrator(engine, queue);

    await orchestrator.processDispatch(job.id);
    await orchestrator.processWorkerTimeout(job.id, firstWorker.id);

    expect(scheduledTimeouts).toEqual([
      { jobId: job.id, workerId: firstWorker.id },
      { jobId: job.id, workerId: secondWorker.id }
    ]);
  });
});
