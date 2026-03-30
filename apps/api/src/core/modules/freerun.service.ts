import { ModuleType, type VehicleType } from "@iwootcall/shared";
import { haversineMeters } from "../dispatch/dispatch.engine.js";
import type { JobService } from "../jobs/job.service.js";
import type { JobRecord } from "../jobs/types.js";

export interface RunStop {
  seq?: number;
  lat: number;
  lng: number;
  address: string;
  recipientPhone: string;
  itemDesc: string;
}

export interface FreeRunBatchInput {
  originLat: number;
  originLng: number;
  originAddress: string;
  vehicleType?: VehicleType;
  stops: RunStop[];
}

export class FreeRunService {
  constructor(private readonly jobService: JobService) {}

  async createBatchJob(
    customerId: string,
    input: FreeRunBatchInput
  ): Promise<JobRecord> {
    const optimizedStops = optimizeStops(input.originLat, input.originLng, input.stops);
    const lastStop = optimizedStops.at(-1);
    const totalDistanceMeters = calculateTotalDistanceMeters(
      input.originLat,
      input.originLng,
      optimizedStops
    );

    return this.jobService.createJob({
      customerId,
      module: ModuleType.FREERUN,
      originLat: input.originLat,
      originLng: input.originLng,
      originAddress: input.originAddress,
      destLat: lastStop?.lat ?? null,
      destLng: lastStop?.lng ?? null,
      destAddress: lastStop?.address ?? null,
      metadata: {
        vehicleType: input.vehicleType,
        stops: optimizedStops,
        totalDistanceMeters
      }
    });
  }
}

export function optimizeStops(
  originLat: number,
  originLng: number,
  stops: RunStop[]
): RunStop[] {
  const remainingStops = stops.map((stop) => ({ ...stop }));
  const orderedStops: RunStop[] = [];
  let currentLat = originLat;
  let currentLng = originLng;

  while (remainingStops.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    remainingStops.forEach((stop, index) => {
      const distance = haversineMeters(currentLat, currentLng, stop.lat, stop.lng);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [nextStop] = remainingStops.splice(nearestIndex, 1);
    orderedStops.push({
      ...nextStop,
      seq: orderedStops.length + 1
    });
    currentLat = nextStop.lat;
    currentLng = nextStop.lng;
  }

  return orderedStops;
}

function calculateTotalDistanceMeters(
  originLat: number,
  originLng: number,
  stops: RunStop[]
): number {
  if (stops.length === 0) {
    return 0;
  }

  let currentLat = originLat;
  let currentLng = originLng;
  let totalDistance = 0;

  for (const stop of stops) {
    totalDistance += haversineMeters(currentLat, currentLng, stop.lat, stop.lng);
    currentLat = stop.lat;
    currentLng = stop.lng;
  }

  return totalDistance;
}
