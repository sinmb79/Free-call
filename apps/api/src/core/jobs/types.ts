import { ModuleType, VehicleType } from "@iwootcall/shared";

export enum JobStatus {
  PENDING = "PENDING",
  DISPATCHED = "DISPATCHED",
  ACCEPTED = "ACCEPTED",
  ARRIVED = "ARRIVED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_WORKER = "NO_WORKER"
}

export interface JobRecord {
  id: string;
  module: ModuleType;
  customerId: string;
  workerId: string | null;
  status: JobStatus;
  originLat: number;
  originLng: number;
  originAddress: string;
  destLat: number | null;
  destLng: number | null;
  destAddress: string | null;
  estimatedKm: number | null;
  estimatedFare: number | null;
  fare: number | null;
  metadata: Record<string, unknown>;
  dispatchedAt: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobCreateInput {
  customerId: string;
  module: ModuleType;
  originLat: number;
  originLng: number;
  originAddress: string;
  destLat?: number | null;
  destLng?: number | null;
  destAddress?: string | null;
  estimatedKm?: number | null;
  estimatedFare?: number | null;
  fare?: number | null;
  metadata?: Record<string, unknown>;
}

export interface DispatchMetadata {
  vehicleType?: VehicleType;
  attemptedWorkerIds?: string[];
  retryCount?: number;
  [key: string]: unknown;
}

export interface JobListFilters {
  customerId?: string;
  workerId?: string;
  status?: JobStatus;
  module?: ModuleType;
  limit?: number;
}

export interface WorkerEarningsSummary {
  totalEarnings: number;
  completedJobs: number;
}
