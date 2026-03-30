import type { ModuleType } from "@iwootcall/shared";
import type { WorkerStore } from "../auth/store.js";
import type { JobStore } from "../jobs/store.js";
import { JobStatus, type JobRecord } from "../jobs/types.js";

export interface AdminModuleStats {
  module: ModuleType;
  totalJobs: number;
  completedJobs: number;
  grossFare: number;
  activeWorkers: number;
  onlineWorkers: number;
}

export interface AdminStatsResponse {
  summary: {
    totalJobs: number;
    completedJobs: number;
    grossFare: number;
    activeWorkers: number;
    onlineWorkers: number;
  };
  perModule: AdminModuleStats[];
}

export class AdminStatsService {
  constructor(
    private readonly enabledModules: ModuleType[],
    private readonly workerStore: Pick<WorkerStore, "list">,
    private readonly jobStore: Pick<JobStore, "list">
  ) {}

  async getStats(range: "today" | "all" = "today"): Promise<AdminStatsResponse> {
    const [workers, jobs] = await Promise.all([
      this.workerStore.list(),
      this.jobStore.list()
    ]);
    const filteredJobs = range === "today" ? jobs.filter(isTodayJob) : jobs;
    const perModule = this.enabledModules.map((typedModule) => {
      const moduleJobs = filteredJobs.filter((job) => job.module === typedModule);
      const moduleWorkers = workers.filter((worker) => worker.module === typedModule);

      return {
        module: typedModule,
        totalJobs: moduleJobs.length,
        completedJobs: moduleJobs.filter((job) => job.status === JobStatus.COMPLETED)
          .length,
        grossFare: moduleJobs.reduce((sum, job) => sum + (job.fare ?? 0), 0),
        activeWorkers: moduleWorkers.filter((worker) => worker.status === "ACTIVE")
          .length,
        onlineWorkers: moduleWorkers.filter((worker) => worker.isOnline).length
      };
    });

    return {
      summary: {
        totalJobs: filteredJobs.length,
        completedJobs: filteredJobs.filter((job) => job.status === JobStatus.COMPLETED)
          .length,
        grossFare: filteredJobs.reduce((sum, job) => sum + (job.fare ?? 0), 0),
        activeWorkers: workers.filter((worker) => worker.status === "ACTIVE").length,
        onlineWorkers: workers.filter((worker) => worker.isOnline).length
      },
      perModule
    };
  }
}

function isTodayJob(job: JobRecord): boolean {
  const reference =
    job.completedAt ??
    job.startedAt ??
    job.acceptedAt ??
    job.dispatchedAt ??
    job.createdAt;
  const date = new Date(reference);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return date >= start && date < end;
}
