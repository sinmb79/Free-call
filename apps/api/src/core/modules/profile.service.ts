import { ModuleType } from "@iwootcall/shared";
import type { WorkerStore } from "../auth/store.js";
import type {
  CargoProfileRecord,
  CargoProfileUpdateInput,
  DriveProfileRecord,
  DriveProfileUpdateInput
} from "./types.js";
import {
  defaultCargoProfile,
  defaultDriveProfile,
  type CargoProfileStore,
  type DriveProfileStore
} from "./store.js";

export class WorkerModuleProfileError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export class WorkerModuleProfileService {
  constructor(
    private readonly workerStore: Pick<WorkerStore, "findById">,
    private readonly driveProfileStore: DriveProfileStore,
    private readonly cargoProfileStore: CargoProfileStore
  ) {}

  async getDriveProfile(workerId: string): Promise<DriveProfileRecord> {
    await this.assertWorkerModule(workerId, ModuleType.FREEDRIVE);
    return (
      (await this.driveProfileStore.findByWorkerId(workerId)) ??
      defaultDriveProfile(workerId)
    );
  }

  async updateDriveProfile(
    workerId: string,
    input: DriveProfileUpdateInput
  ): Promise<DriveProfileRecord> {
    await this.assertWorkerModule(workerId, ModuleType.FREEDRIVE);
    return this.driveProfileStore.upsertForWorker(workerId, input);
  }

  async getCargoProfile(workerId: string): Promise<CargoProfileRecord> {
    await this.assertWorkerModule(workerId, ModuleType.FREECARGO);
    return (
      (await this.cargoProfileStore.findByWorkerId(workerId)) ??
      defaultCargoProfile(workerId)
    );
  }

  async updateCargoProfile(
    workerId: string,
    input: CargoProfileUpdateInput
  ): Promise<CargoProfileRecord> {
    await this.assertWorkerModule(workerId, ModuleType.FREECARGO);
    return this.cargoProfileStore.upsertForWorker(workerId, input);
  }

  private async assertWorkerModule(
    workerId: string,
    module: ModuleType
  ): Promise<void> {
    const worker = await this.workerStore.findById(workerId);
    if (!worker) {
      throw new WorkerModuleProfileError("Worker not found", 404);
    }
    if (worker.module !== module) {
      throw new WorkerModuleProfileError(
        `Worker module does not support ${module.toLowerCase()} profile`,
        400
      );
    }
  }
}
