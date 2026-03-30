import {
  Prisma,
  PrismaClient,
  type Job,
  type JobStatus as PrismaJobStatus,
  type ModuleType as PrismaModuleType
} from "@prisma/client";
import type { JobStore } from "../jobs/store.js";
import type {
  JobCreateInput,
  JobListFilters,
  JobRecord,
  WorkerEarningsSummary
} from "../jobs/types.js";
import { JobStatus } from "../jobs/types.js";

export class PrismaJobStore implements JobStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: JobCreateInput): Promise<JobRecord> {
    const job = await this.prisma.job.create({
      data: {
        module: input.module as PrismaModuleType,
        customerId: input.customerId,
        originLat: input.originLat,
        originLng: input.originLng,
        originAddress: input.originAddress,
        destLat: input.destLat,
        destLng: input.destLng,
        destAddress: input.destAddress,
        estimatedKm: input.estimatedKm,
        estimatedFare: input.estimatedFare,
        fare: input.fare,
        metadata: toPrismaJson(input.metadata)
      }
    });

    return mapJob(job);
  }

  async findById(id: string): Promise<JobRecord | null> {
    const job = await this.prisma.job.findUnique({
      where: { id }
    });
    return job ? mapJob(job) : null;
  }

  async findForCustomer(customerId: string, jobId: string): Promise<JobRecord | null> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        customerId
      }
    });

    return job ? mapJob(job) : null;
  }

  async findActiveByWorkerId(workerId: string): Promise<JobRecord | null> {
    const job = await this.prisma.job.findFirst({
      where: {
        workerId,
        status: {
          in: [
            "DISPATCHED",
            "ACCEPTED",
            "ARRIVED",
            "IN_PROGRESS"
          ]
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return job ? mapJob(job) : null;
  }

  async list(filters?: JobListFilters): Promise<JobRecord[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        customerId: filters?.customerId,
        workerId: filters?.workerId,
        status: filters?.status as PrismaJobStatus | undefined,
        module: filters?.module as PrismaModuleType | undefined
      },
      orderBy: {
        createdAt: "desc"
      },
      take: filters?.limit
    });

    return jobs.map(mapJob);
  }

  async summarizeWorkerEarningsToday(
    workerId: string,
    now = new Date()
  ): Promise<WorkerEarningsSummary> {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [aggregate, completedJobs] = await Promise.all([
      this.prisma.job.aggregate({
        where: {
          workerId,
          status: "COMPLETED",
          completedAt: {
            gte: start,
            lt: end
          }
        },
        _sum: {
          fare: true
        }
      }),
      this.prisma.job.count({
        where: {
          workerId,
          status: "COMPLETED",
          completedAt: {
            gte: start,
            lt: end
          }
        }
      })
    ]);

    return {
      totalEarnings: aggregate._sum.fare ?? 0,
      completedJobs
    };
  }

  async update(id: string, input: Partial<JobRecord>): Promise<JobRecord | null> {
    try {
      const job = await this.prisma.job.update({
        where: { id },
        data: {
          module: input.module as PrismaModuleType | undefined,
          customerId: input.customerId,
          workerId: input.workerId,
          status: input.status as PrismaJobStatus | undefined,
          originLat: input.originLat,
          originLng: input.originLng,
          originAddress: input.originAddress,
          destLat: input.destLat,
          destLng: input.destLng,
          destAddress: input.destAddress,
          estimatedKm: input.estimatedKm,
          estimatedFare: input.estimatedFare,
          fare: input.fare,
          metadata:
            input.metadata === undefined ? undefined : toPrismaJson(input.metadata),
          dispatchedAt: input.dispatchedAt ? new Date(input.dispatchedAt) : undefined,
          acceptedAt: input.acceptedAt ? new Date(input.acceptedAt) : undefined,
          arrivedAt: input.arrivedAt ? new Date(input.arrivedAt) : undefined,
          startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
          completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
          cancelledAt: input.cancelledAt ? new Date(input.cancelledAt) : undefined,
          cancelReason: input.cancelReason
        }
      });
      return mapJob(job);
    } catch {
      return null;
    }
  }
}

function toPrismaJson(
  value: Record<string, unknown> | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function mapJob(job: Job): JobRecord {
  return {
    id: job.id,
    module: job.module as JobRecord["module"],
    customerId: job.customerId,
    workerId: job.workerId,
    status: job.status as JobStatus,
    originLat: job.originLat,
    originLng: job.originLng,
    originAddress: job.originAddress,
    destLat: job.destLat,
    destLng: job.destLng,
    destAddress: job.destAddress,
    estimatedKm: job.estimatedKm,
    estimatedFare: job.estimatedFare,
    fare: job.fare,
    metadata:
      job.metadata && typeof job.metadata === "object"
        ? (job.metadata as Record<string, unknown>)
        : {},
    dispatchedAt: job.dispatchedAt?.toISOString() ?? null,
    acceptedAt: job.acceptedAt?.toISOString() ?? null,
    arrivedAt: job.arrivedAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    cancelReason: job.cancelReason,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}
