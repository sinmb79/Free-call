import type { JobRecord } from "../jobs/types.js";

export interface DriveProfileRecord {
  workerId: string;
  maxReturnWalkMeters: number;
}

export interface DriveProfileUpdateInput {
  maxReturnWalkMeters?: number;
}

export interface CargoProfileRecord {
  workerId: string;
  canLoadingHelp: boolean;
  hasForklift: boolean;
  businessRegNo: string | null;
}

export interface CargoProfileUpdateInput {
  canLoadingHelp?: boolean;
  hasForklift?: boolean;
  businessRegNo?: string | null;
}

export interface ShuttleWaypoint {
  lat: number;
  lng: number;
  label?: string;
}

export interface ShuttleRouteRecord {
  id: string;
  name: string;
  regionCode: string;
  isActive: boolean;
  waypoints: ShuttleWaypoint[];
  createdAt: string;
}

export interface ShuttleRouteCreateInput {
  name: string;
  regionCode: string;
  isActive?: boolean;
  waypoints: ShuttleWaypoint[];
}

export interface ShuttleRouteUpdateInput {
  name?: string;
  regionCode?: string;
  isActive?: boolean;
  waypoints?: ShuttleWaypoint[];
}

export interface ShuttleScheduleRecord {
  id: string;
  routeId: string;
  departure: string;
  seats: number;
  bookedSeats: number;
}

export interface ShuttleScheduleCreateInput {
  routeId: string;
  departure: string;
  seats?: number;
}

export interface ShuttleScheduleUpdateInput {
  departure?: string;
  seats?: number;
  bookedSeats?: number;
}

export interface ShuttleBookingInput {
  routeId: string;
  scheduleId: string;
  originLat: number;
  originLng: number;
  originAddress: string;
}

export interface ShuttleBookingResult {
  job: JobRecord;
  schedule: ShuttleScheduleRecord;
}
