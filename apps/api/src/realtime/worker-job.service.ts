import type { WorkerStore } from "../core/auth/store.js";
import type { WorkerRecord } from "../core/auth/types.js";
import type { DispatchEventSink } from "../core/dispatch/dispatch.engine.js";
import type { DispatchEngine } from "../core/dispatch/dispatch.engine.js";
import type { DispatchQueue } from "../core/jobs/queue.js";
import type { JobStore } from "../core/jobs/store.js";
import { JobStatus, type JobRecord } from "../core/jobs/types.js";

export class WorkerJobService {
  constructor(
    private readonly workerStore: Pick<
      WorkerStore,
      "findById" | "updatePresence"
    >,
    private readonly jobStore: Pick<
      JobStore,
      "findById" | "findActiveByWorkerId" | "update"
    >,
    private readonly dispatchEngine: DispatchEngine,
    private readonly dispatchQueue: Pick<DispatchQueue, "scheduleWorkerTimeout">,
    private readonly eventSink: DispatchEventSink
  ) {}

  async handleLocationUpdate(
    workerId: string,
    lat: number,
    lng: number
  ): Promise<void> {
    const worker = await this.workerStore.updatePresence(workerId, {
      isOnline: true,
      lat,
      lng
    });
    if (!worker || !this.eventSink.emitWorkerLocation) {
      return;
    }

    const job = await this.jobStore.findActiveByWorkerId(workerId);
    if (!job) {
      return;
    }

    await this.eventSink.emitWorkerLocation(job, worker);
  }

  async handleCallAccept(workerId: string, jobId: string): Promise<JobRecord | null> {
    const context = await this.loadWorkerJobContext(workerId, jobId);
    if (!context || context.job.status !== JobStatus.DISPATCHED) {
      return null;
    }

    const acceptedJob = await this.jobStore.update(jobId, {
      status: JobStatus.ACCEPTED,
      acceptedAt: new Date().toISOString()
    });
    if (!acceptedJob) {
      return null;
    }

    if (this.eventSink.emitWorkerAssigned) {
      await this.eventSink.emitWorkerAssigned(acceptedJob, context.worker);
    }

    return acceptedJob;
  }

  async handleCallReject(workerId: string, jobId: string): Promise<void> {
    const nextWorkerId = await this.dispatchEngine.onWorkerTimeout(jobId, workerId);
    if (nextWorkerId) {
      await this.dispatchQueue.scheduleWorkerTimeout(jobId, nextWorkerId);
    }
  }

  async handleArrived(workerId: string, jobId: string): Promise<JobRecord | null> {
    return this.transitionJob(workerId, jobId, JobStatus.ARRIVED, "arrivedAt");
  }

  async handleJobStart(workerId: string, jobId: string): Promise<JobRecord | null> {
    return this.transitionJob(workerId, jobId, JobStatus.IN_PROGRESS, "startedAt");
  }

  async handleJobComplete(workerId: string, jobId: string): Promise<JobRecord | null> {
    return this.transitionJob(workerId, jobId, JobStatus.COMPLETED, "completedAt");
  }

  private async transitionJob(
    workerId: string,
    jobId: string,
    status: JobStatus,
    timestampField: "arrivedAt" | "startedAt" | "completedAt"
  ): Promise<JobRecord | null> {
    const context = await this.loadWorkerJobContext(workerId, jobId);
    if (!context) {
      return null;
    }

    const updatedJob = await this.jobStore.update(jobId, {
      status,
      [timestampField]: new Date().toISOString()
    });
    if (!updatedJob) {
      return null;
    }

    if (status === JobStatus.ARRIVED && this.eventSink.emitWorkerArrived) {
      await this.eventSink.emitWorkerArrived(updatedJob, context.worker);
    }
    if (status === JobStatus.IN_PROGRESS && this.eventSink.emitJobStarted) {
      await this.eventSink.emitJobStarted(updatedJob, context.worker);
    }
    if (status === JobStatus.COMPLETED && this.eventSink.emitJobCompleted) {
      await this.eventSink.emitJobCompleted(updatedJob, context.worker);
    }

    return updatedJob;
  }

  private async loadWorkerJobContext(
    workerId: string,
    jobId: string
  ): Promise<{ job: JobRecord; worker: WorkerRecord } | null> {
    const [job, worker] = await Promise.all([
      this.jobStore.findById(jobId),
      this.workerStore.findById(workerId)
    ]);
    if (!job || !worker || job.workerId !== workerId) {
      return null;
    }

    return { job, worker };
  }
}
