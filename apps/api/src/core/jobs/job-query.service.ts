import type { ModuleType } from "@iwootcall/shared";
import type { JobStore } from "./store.js";
import { JobStatus, type JobRecord, type WorkerEarningsSummary } from "./types.js";

export class JobQueryError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export class JobQueryService {
  constructor(private readonly jobStore: JobStore) {}

  async listCustomerJobs(customerId: string): Promise<JobRecord[]> {
    return this.jobStore.list({
      customerId
    });
  }

  async getCustomerJob(customerId: string, jobId: string): Promise<JobRecord> {
    const job = await this.jobStore.findForCustomer(customerId, jobId);
    if (!job) {
      throw new JobQueryError("Job not found", 404);
    }

    return job;
  }

  async getActiveWorkerJob(workerId: string): Promise<JobRecord | null> {
    return this.jobStore.findActiveByWorkerId(workerId);
  }

  async getWorkerEarningsToday(workerId: string): Promise<WorkerEarningsSummary> {
    return this.jobStore.summarizeWorkerEarningsToday(workerId);
  }

  async listAdminJobs(filters: {
    status?: JobStatus;
    module?: ModuleType;
    workerId?: string;
    customerId?: string;
    limit?: number;
  }): Promise<JobRecord[]> {
    return this.jobStore.list(filters);
  }
}
