import { randomUUID } from "node:crypto";
import type {
  CargoProfileRecord,
  CargoProfileUpdateInput,
  DriveProfileRecord,
  DriveProfileUpdateInput,
  ShuttleRouteCreateInput,
  ShuttleRouteRecord,
  ShuttleRouteUpdateInput,
  ShuttleScheduleCreateInput,
  ShuttleScheduleRecord,
  ShuttleScheduleUpdateInput
} from "./types.js";

export interface DriveProfileStore {
  findByWorkerId(workerId: string): Promise<DriveProfileRecord | null>;
  upsertForWorker(
    workerId: string,
    input: DriveProfileUpdateInput
  ): Promise<DriveProfileRecord>;
}

export interface CargoProfileStore {
  findByWorkerId(workerId: string): Promise<CargoProfileRecord | null>;
  upsertForWorker(
    workerId: string,
    input: CargoProfileUpdateInput
  ): Promise<CargoProfileRecord>;
}

export interface ShuttleRouteStore {
  list(input?: { isActive?: boolean }): Promise<ShuttleRouteRecord[]>;
  findById(id: string): Promise<ShuttleRouteRecord | null>;
  create(input: ShuttleRouteCreateInput): Promise<ShuttleRouteRecord>;
  update(
    id: string,
    input: ShuttleRouteUpdateInput
  ): Promise<ShuttleRouteRecord | null>;
}

export interface ShuttleScheduleStore {
  list(input?: { routeId?: string }): Promise<ShuttleScheduleRecord[]>;
  findById(id: string): Promise<ShuttleScheduleRecord | null>;
  create(input: ShuttleScheduleCreateInput): Promise<ShuttleScheduleRecord>;
  update(
    id: string,
    input: ShuttleScheduleUpdateInput
  ): Promise<ShuttleScheduleRecord | null>;
  reserveSeat(id: string): Promise<ShuttleScheduleRecord | null>;
  releaseSeat(id: string): Promise<ShuttleScheduleRecord | null>;
}

export const defaultDriveProfile = (workerId: string): DriveProfileRecord => ({
  workerId,
  maxReturnWalkMeters: 1500
});

export const defaultCargoProfile = (workerId: string): CargoProfileRecord => ({
  workerId,
  canLoadingHelp: false,
  hasForklift: false,
  businessRegNo: null
});

export class InMemoryDriveProfileStore implements DriveProfileStore {
  private readonly profiles = new Map<string, DriveProfileRecord>();

  async findByWorkerId(workerId: string): Promise<DriveProfileRecord | null> {
    return this.profiles.get(workerId) ?? null;
  }

  async upsertForWorker(
    workerId: string,
    input: DriveProfileUpdateInput
  ): Promise<DriveProfileRecord> {
    const existing = this.profiles.get(workerId) ?? defaultDriveProfile(workerId);
    const profile: DriveProfileRecord = {
      ...existing,
      maxReturnWalkMeters:
        input.maxReturnWalkMeters ?? existing.maxReturnWalkMeters
    };
    this.profiles.set(workerId, profile);
    return profile;
  }
}

export class InMemoryCargoProfileStore implements CargoProfileStore {
  private readonly profiles = new Map<string, CargoProfileRecord>();

  async findByWorkerId(workerId: string): Promise<CargoProfileRecord | null> {
    return this.profiles.get(workerId) ?? null;
  }

  async upsertForWorker(
    workerId: string,
    input: CargoProfileUpdateInput
  ): Promise<CargoProfileRecord> {
    const existing = this.profiles.get(workerId) ?? defaultCargoProfile(workerId);
    const profile: CargoProfileRecord = {
      ...existing,
      canLoadingHelp: input.canLoadingHelp ?? existing.canLoadingHelp,
      hasForklift: input.hasForklift ?? existing.hasForklift,
      businessRegNo:
        input.businessRegNo === undefined
          ? existing.businessRegNo
          : input.businessRegNo
    };
    this.profiles.set(workerId, profile);
    return profile;
  }
}

export class InMemoryShuttleRouteStore implements ShuttleRouteStore {
  private readonly routes = new Map<string, ShuttleRouteRecord>();

  async list(input?: { isActive?: boolean }): Promise<ShuttleRouteRecord[]> {
    return Array.from(this.routes.values())
      .filter((route) =>
        input?.isActive === undefined ? true : route.isActive === input.isActive
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async findById(id: string): Promise<ShuttleRouteRecord | null> {
    return this.routes.get(id) ?? null;
  }

  async create(input: ShuttleRouteCreateInput): Promise<ShuttleRouteRecord> {
    const route: ShuttleRouteRecord = {
      id: randomUUID(),
      name: input.name,
      regionCode: input.regionCode,
      isActive: input.isActive ?? true,
      waypoints: input.waypoints,
      createdAt: new Date().toISOString()
    };
    this.routes.set(route.id, route);
    return route;
  }

  async update(
    id: string,
    input: ShuttleRouteUpdateInput
  ): Promise<ShuttleRouteRecord | null> {
    const existing = this.routes.get(id);
    if (!existing) {
      return null;
    }

    const route: ShuttleRouteRecord = {
      ...existing,
      name: input.name ?? existing.name,
      regionCode: input.regionCode ?? existing.regionCode,
      isActive: input.isActive ?? existing.isActive,
      waypoints: input.waypoints ?? existing.waypoints
    };
    this.routes.set(id, route);
    return route;
  }
}

export class InMemoryShuttleScheduleStore implements ShuttleScheduleStore {
  private readonly schedules = new Map<string, ShuttleScheduleRecord>();

  async list(input?: { routeId?: string }): Promise<ShuttleScheduleRecord[]> {
    return Array.from(this.schedules.values())
      .filter((schedule) =>
        input?.routeId ? schedule.routeId === input.routeId : true
      )
      .sort((left, right) => left.departure.localeCompare(right.departure));
  }

  async findById(id: string): Promise<ShuttleScheduleRecord | null> {
    return this.schedules.get(id) ?? null;
  }

  async create(input: ShuttleScheduleCreateInput): Promise<ShuttleScheduleRecord> {
    const schedule: ShuttleScheduleRecord = {
      id: randomUUID(),
      routeId: input.routeId,
      departure: input.departure,
      seats: input.seats ?? 8,
      bookedSeats: 0
    };
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  async update(
    id: string,
    input: ShuttleScheduleUpdateInput
  ): Promise<ShuttleScheduleRecord | null> {
    const existing = this.schedules.get(id);
    if (!existing) {
      return null;
    }

    const schedule: ShuttleScheduleRecord = {
      ...existing,
      departure: input.departure ?? existing.departure,
      seats: input.seats ?? existing.seats,
      bookedSeats: input.bookedSeats ?? existing.bookedSeats
    };
    this.schedules.set(id, schedule);
    return schedule;
  }

  async reserveSeat(id: string): Promise<ShuttleScheduleRecord | null> {
    const existing = this.schedules.get(id);
    if (!existing || existing.bookedSeats >= existing.seats) {
      return null;
    }

    const schedule: ShuttleScheduleRecord = {
      ...existing,
      bookedSeats: existing.bookedSeats + 1
    };
    this.schedules.set(id, schedule);
    return schedule;
  }

  async releaseSeat(id: string): Promise<ShuttleScheduleRecord | null> {
    const existing = this.schedules.get(id);
    if (!existing) {
      return null;
    }
    if (existing.bookedSeats === 0) {
      return existing;
    }

    const schedule: ShuttleScheduleRecord = {
      ...existing,
      bookedSeats: existing.bookedSeats - 1
    };
    this.schedules.set(id, schedule);
    return schedule;
  }
}
