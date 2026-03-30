import type { WorkerStore } from "../auth/store.js";
import type { DeviceTokenUpdateInput, WorkerRecord } from "../auth/types.js";

export class WorkerServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export class WorkerService {
  constructor(
    private readonly workerStore: Pick<
      WorkerStore,
      "findById" | "updatePresence" | "updateDeviceToken"
    >
  ) {}

  async getWorker(workerId: string): Promise<WorkerRecord> {
    const worker = await this.workerStore.findById(workerId);
    if (!worker) {
      throw new WorkerServiceError("Worker not found", 404);
    }

    return worker;
  }

  async updatePresence(
    workerId: string,
    input: {
      isOnline: boolean;
      lat?: number | null;
      lng?: number | null;
    }
  ): Promise<WorkerRecord> {
    const worker = await this.workerStore.updatePresence(workerId, {
      isOnline: input.isOnline,
      lat: input.isOnline ? input.lat ?? null : null,
      lng: input.isOnline ? input.lng ?? null : null
    });
    if (!worker) {
      throw new WorkerServiceError("Worker not found", 404);
    }

    return worker;
  }

  async updateDeviceToken(
    workerId: string,
    input: DeviceTokenUpdateInput
  ): Promise<WorkerRecord> {
    const worker = await this.workerStore.updateDeviceToken(workerId, input);
    if (!worker) {
      throw new WorkerServiceError("Worker not found", 404);
    }

    return worker;
  }
}
