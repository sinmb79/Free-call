import { randomUUID } from "node:crypto";
import type {
  JobCreateInput,
  JobListFilters,
  JobRecord,
  WorkerEarningsSummary
} from "./types.js";
import { JobStatus } from "./types.js";

export interface JobStore {
  create(input: JobCreateInput): Promise<JobRecord>;
  findById(id: string): Promise<JobRecord | null>;
  findForCustomer(customerId: string, jobId: string): Promise<JobRecord | null>;
  findActiveByWorkerId(workerId: string): Promise<JobRecord | null>;
  list(filters?: JobListFilters): Promise<JobRecord[]>;
  summarizeWorkerEarningsToday(workerId: string, now?: Date): Promise<WorkerEarningsSummary>;
  update(id: string, input: Partial<JobRecord>): Promise<JobRecord | null>;
}

export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, JobRecord>();

  async create(input: JobCreateInput): Promise<JobRecord> {
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: randomUUID(),
      module: input.module,
      customerId: input.customerId,
      workerId: null,
      status: JobStatus.PENDING,
      originLat: input.originLat,
      originLng: input.originLng,
      originAddress: input.originAddress,
      destLat: input.destLat ?? null,
      destLng: input.destLng ?? null,
      destAddress: input.destAddress ?? null,
      estimatedKm: input.estimatedKm ?? null,
      estimatedFare: input.estimatedFare ?? null,
      fare: input.fare ?? null,
      metadata: input.metadata ?? {},
      dispatchedAt: null,
      acceptedAt: null,
      arrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now
    };

    this.jobs.set(job.id, job);
    return job;
  }

  async findById(id: string): Promise<JobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  async findForCustomer(
    customerId: string,
    jobId: string
  ): Promise<JobRecord | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.customerId !== customerId) {
      return null;
    }

    return job;
  }

  async findActiveByWorkerId(workerId: string): Promise<JobRecord | null> {
    const activeStatuses = new Set([
      JobStatus.DISPATCHED,
      JobStatus.ACCEPTED,
      JobStatus.ARRIVED,
      JobStatus.IN_PROGRESS
    ]);

    const jobs = Array.from(this.jobs.values())
      .filter((job) => job.workerId === workerId && activeStatuses.has(job.status))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return jobs[0] ?? null;
  }

  async list(filters?: JobListFilters): Promise<JobRecord[]> {
    return Array.from(this.jobs.values())
      .filter((job) =>
        filters?.customerId ? job.customerId === filters.customerId : true
      )
      .filter((job) => (filters?.workerId ? job.workerId === filters.workerId : true))
      .filter((job) => (filters?.status ? job.status === filters.status : true))
      .filter((job) => (filters?.module ? job.module === filters.module : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, filters?.limit ?? Number.MAX_SAFE_INTEGER);
  }

  async summarizeWorkerEarningsToday(
    workerId: string,
    now = new Date()
  ): Promise<WorkerEarningsSummary> {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const jobs = Array.from(this.jobs.values()).filter((job) => {
      if (job.workerId !== workerId || job.status !== JobStatus.COMPLETED) {
        return false;
      }
      if (!job.completedAt) {
        return false;
      }

      const completedAt = new Date(job.completedAt);
      return completedAt >= start && completedAt < end;
    });

    return {
      totalEarnings: jobs.reduce((sum, job) => sum + (job.fare ?? 0), 0),
      completedJobs: jobs.length
    };
  }

  async update(id: string, input: Partial<JobRecord>): Promise<JobRecord | null> {
    const existingJob = this.jobs.get(id);
    if (!existingJob) {
      return null;
    }

    const updatedJob: JobRecord = {
      ...existingJob,
      ...input,
      updatedAt: new Date().toISOString()
    };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }
}
