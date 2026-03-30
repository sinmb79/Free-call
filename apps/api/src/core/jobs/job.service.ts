import { haversineMeters } from "../dispatch/dispatch.engine.js";
import type { DispatchEngine } from "../dispatch/dispatch.engine.js";
import type { DispatchQueue } from "./queue.js";
import type { JobStore } from "./store.js";
import type { JobCreateInput, JobRecord } from "./types.js";

export class JobService {
  constructor(
    private readonly jobStore: JobStore,
    private readonly dispatchEngine: DispatchEngine,
    private readonly dispatchQueue: DispatchQueue
  ) {}

  async createJob(input: JobCreateInput): Promise<JobRecord> {
    const totalDistanceMeters =
      typeof input.metadata?.totalDistanceMeters === "number"
        ? input.metadata.totalDistanceMeters
        : null;
    const estimatedKm =
      totalDistanceMeters != null
        ? totalDistanceMeters / 1000
        : input.destLat != null && input.destLng != null
          ? haversineMeters(
              input.originLat,
              input.originLng,
              input.destLat,
              input.destLng
            ) / 1000
          : null;
    const estimatedFare = this.dispatchEngine.estimateFare(
      input.module,
      estimatedKm ? estimatedKm * 1000 : 0,
      0,
      input.metadata
    );

    const job = await this.jobStore.create({
      ...input,
      estimatedKm,
      estimatedFare
    });

    await this.dispatchQueue.enqueue(job.id);
    return (await this.jobStore.findById(job.id)) ?? job;
  }
}
