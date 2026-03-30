/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import { ModuleType, VehicleType } from "@iwootcall/shared";
import type {
  WorkerStore
} from "../auth/store.js";
import type { WorkerRecord } from "../auth/types.js";
import type { JobStore } from "../jobs/store.js";
import { JobStatus, type DispatchMetadata, type JobRecord } from "../jobs/types.js";

export interface DispatchCandidate {
  workerId: string;
  distanceMeters: number;
  etaSeconds: number;
  lat: number;
  lng: number;
}

export interface WorkerAvailability {
  id: string;
  module: ModuleType;
  vehicleType: VehicleType;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
}

export interface DispatchEventSink {
  emitIncomingCall(workerId: string, job: JobRecord): void | Promise<void>;
  emitDispatchFailed(job: JobRecord): void | Promise<void>;
  emitWorkerAssigned?(job: JobRecord, worker: WorkerRecord): void | Promise<void>;
  emitWorkerLocation?(job: JobRecord, worker: WorkerRecord): void | Promise<void>;
  emitWorkerArrived?(job: JobRecord, worker: WorkerRecord): void | Promise<void>;
  emitJobStarted?(job: JobRecord, worker: WorkerRecord): void | Promise<void>;
  emitJobCompleted?(job: JobRecord, worker: WorkerRecord): void | Promise<void>;
}

export class DispatchEngine {
  constructor(
    private readonly workerStore: Pick<
      WorkerStore,
      "list" | "findById" | "findNearbyCandidates"
    >,
    private readonly jobStore: JobStore,
    private readonly eventSink: DispatchEventSink,
    private readonly averageSpeedMetersPerSecond = 8.33,
    private readonly maxRetryCount = 5
  ) {}

  async findNearbyWorkers(
    module: ModuleType,
    originLat: number,
    originLng: number,
    radiusMeters: number,
    vehicleTypeFilter?: VehicleType[],
    limit = 5
  ): Promise<DispatchCandidate[]> {
    if (this.workerStore.findNearbyCandidates) {
      return this.workerStore.findNearbyCandidates({
        module,
        originLat,
        originLng,
        radiusMeters,
        vehicleTypeFilter,
        limit
      });
    }

    const workers = await this.workerStore.list();

    return workers
      .filter((worker) => worker.isOnline)
      .filter((worker) => worker.status === "ACTIVE")
      .filter((worker) => worker.module === module)
      .filter((worker) => worker.lat !== null && worker.lng !== null)
      .filter((worker) =>
        vehicleTypeFilter?.length
          ? vehicleTypeFilter.includes(worker.vehicleType)
          : true
      )
      .map((worker) => {
        const distanceMeters = haversineMeters(
          originLat,
          originLng,
          worker.lat as number,
          worker.lng as number
        );

        return {
          workerId: worker.id,
          distanceMeters,
          etaSeconds: Math.round(distanceMeters / this.averageSpeedMetersPerSecond),
          lat: worker.lat as number,
          lng: worker.lng as number
        };
      })
      .filter((candidate) => candidate.distanceMeters <= radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, limit);
  }

  async dispatchJob(jobId: string): Promise<string | null> {
    const job = await this.jobStore.findById(jobId);
    if (!job) {
      return null;
    }

    const dispatchMetadata = readDispatchMetadata(job);
    const candidates = await this.findNearbyWorkers(
      job.module,
      job.originLat,
      job.originLng,
      3000,
      readVehicleTypeFilter(job),
      5
    );
    const nextCandidate = candidates.find(
      (candidate) =>
        !dispatchMetadata.attemptedWorkerIds.includes(candidate.workerId)
    );

    if (!nextCandidate) {
      const failedJob = await this.jobStore.update(job.id, {
        status: JobStatus.NO_WORKER,
        workerId: null,
        metadata: {
          ...job.metadata,
          dispatch: dispatchMetadata
        }
      });
      if (failedJob) {
        await this.eventSink.emitDispatchFailed(failedJob);
      }
      return null;
    }

    const updatedJob = await this.jobStore.update(job.id, {
      workerId: nextCandidate.workerId,
      status: JobStatus.DISPATCHED,
      dispatchedAt: new Date().toISOString(),
      metadata: {
        ...job.metadata,
        dispatch: dispatchMetadata
      }
    });
    if (updatedJob) {
      await this.eventSink.emitIncomingCall(nextCandidate.workerId, updatedJob);
    }
    return nextCandidate.workerId;
  }

  async onWorkerTimeout(jobId: string, workerId: string): Promise<string | null> {
    const job = await this.jobStore.findById(jobId);
    if (!job) {
      return null;
    }

    if (job.workerId !== workerId || job.status !== JobStatus.DISPATCHED) {
      return null;
    }

    const dispatchMetadata = readDispatchMetadata(job);
    if (!dispatchMetadata.attemptedWorkerIds.includes(workerId)) {
      dispatchMetadata.attemptedWorkerIds.push(workerId);
    }
    dispatchMetadata.retryCount += 1;

    await this.jobStore.update(job.id, {
      workerId: null,
      metadata: {
        ...job.metadata,
        dispatch: dispatchMetadata
      }
    });

    if (dispatchMetadata.retryCount >= this.maxRetryCount) {
      const failedJob = await this.jobStore.update(job.id, {
        status: JobStatus.NO_WORKER,
        metadata: {
          ...job.metadata,
          dispatch: dispatchMetadata
        }
      });
      if (failedJob) {
        await this.eventSink.emitDispatchFailed(failedJob);
      }
      return null;
    }

    return this.dispatchJob(job.id);
  }

  estimateFare(
    module: ModuleType,
    distanceMeters: number,
    _durationSeconds: number,
    metadata?: Record<string, unknown>
  ): number {
    switch (module) {
      case ModuleType.FREECAB:
        return 4800 + Math.ceil(distanceMeters / 132) * 100;
      case ModuleType.FREEDRIVE:
        if (distanceMeters <= 5000) {
          return 15000;
        }
        if (distanceMeters <= 10000) {
          return 20000;
        }
        return 25000;
      case ModuleType.FREECARGO: {
        const vehicleType = metadata?.vehicleType as VehicleType | undefined;
        const baseFare =
          vehicleType === VehicleType.DAMAS
            ? 15000
            : vehicleType === VehicleType.LABO
              ? 18000
              : 25000;
        return baseFare + Math.ceil(distanceMeters / 1000) * 1000;
      }
      case ModuleType.FREERUN:
        return 5000 + Math.ceil(distanceMeters / 1000) * 1000;
      case ModuleType.FREESHUTTLE:
        return 1000;
    }
  }
}

export function haversineMeters(
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const deltaLat = toRadians(targetLat - originLat);
  const deltaLng = toRadians(targetLng - originLng);
  const lat1 = toRadians(originLat);
  const lat2 = toRadians(targetLat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function readVehicleTypeFilter(job: JobRecord): VehicleType[] | undefined {
  const vehicleType = (job.metadata as DispatchMetadata).vehicleType;
  return vehicleType ? [vehicleType] : undefined;
}

function readDispatchMetadata(job: JobRecord): {
  attemptedWorkerIds: string[];
  retryCount: number;
} {
  const dispatch = (job.metadata.dispatch ?? {}) as DispatchMetadata;
  return {
    attemptedWorkerIds: Array.isArray(dispatch.attemptedWorkerIds)
      ? [...dispatch.attemptedWorkerIds]
      : [],
    retryCount:
      typeof dispatch.retryCount === "number" ? dispatch.retryCount : 0
  };
}
