import {
  Prisma,
  PrismaClient,
  type CargoProfile,
  type DriveProfile,
  type ShuttleRoute,
  type ShuttleSchedule
} from "@prisma/client";
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
} from "../modules/types.js";
import type {
  CargoProfileStore,
  DriveProfileStore,
  ShuttleRouteStore,
  ShuttleScheduleStore
} from "../modules/store.js";

export class PrismaDriveProfileStore implements DriveProfileStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findByWorkerId(workerId: string): Promise<DriveProfileRecord | null> {
    const profile = await this.prisma.driveProfile.findUnique({ where: { workerId } });
    return profile ? mapDriveProfile(profile) : null;
  }

  async upsertForWorker(
    workerId: string,
    input: DriveProfileUpdateInput
  ): Promise<DriveProfileRecord> {
    const profile = await this.prisma.driveProfile.upsert({
      where: { workerId },
      create: {
        workerId,
        maxReturnWalkMeters: input.maxReturnWalkMeters ?? 1500
      },
      update: {
        maxReturnWalkMeters: input.maxReturnWalkMeters
      }
    });
    return mapDriveProfile(profile);
  }
}

export class PrismaCargoProfileStore implements CargoProfileStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findByWorkerId(workerId: string): Promise<CargoProfileRecord | null> {
    const profile = await this.prisma.cargoProfile.findUnique({ where: { workerId } });
    return profile ? mapCargoProfile(profile) : null;
  }

  async upsertForWorker(
    workerId: string,
    input: CargoProfileUpdateInput
  ): Promise<CargoProfileRecord> {
    const profile = await this.prisma.cargoProfile.upsert({
      where: { workerId },
      create: {
        workerId,
        canLoadingHelp: input.canLoadingHelp ?? false,
        hasForklift: input.hasForklift ?? false,
        businessRegNo: input.businessRegNo ?? null
      },
      update: {
        canLoadingHelp: input.canLoadingHelp,
        hasForklift: input.hasForklift,
        businessRegNo: input.businessRegNo
      }
    });
    return mapCargoProfile(profile);
  }
}

export class PrismaShuttleRouteStore implements ShuttleRouteStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(input?: { isActive?: boolean }): Promise<ShuttleRouteRecord[]> {
    const routes = await this.prisma.shuttleRoute.findMany({
      where: { isActive: input?.isActive },
      orderBy: { createdAt: "asc" }
    });
    return routes.map(mapShuttleRoute);
  }

  async findById(id: string): Promise<ShuttleRouteRecord | null> {
    const route = await this.prisma.shuttleRoute.findUnique({ where: { id } });
    return route ? mapShuttleRoute(route) : null;
  }

  async create(input: ShuttleRouteCreateInput): Promise<ShuttleRouteRecord> {
    const route = await this.prisma.shuttleRoute.create({
      data: {
        name: input.name,
        regionCode: input.regionCode,
        isActive: input.isActive ?? true,
        waypoints: input.waypoints as unknown as Prisma.InputJsonValue
      }
    });
    return mapShuttleRoute(route);
  }

  async update(
    id: string,
    input: ShuttleRouteUpdateInput
  ): Promise<ShuttleRouteRecord | null> {
    try {
      const route = await this.prisma.shuttleRoute.update({
        where: { id },
        data: {
          name: input.name,
          regionCode: input.regionCode,
          isActive: input.isActive,
          waypoints:
            input.waypoints === undefined
              ? undefined
              : (input.waypoints as unknown as Prisma.InputJsonValue)
        }
      });
      return mapShuttleRoute(route);
    } catch {
      return null;
    }
  }
}

export class PrismaShuttleScheduleStore implements ShuttleScheduleStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(input?: { routeId?: string }): Promise<ShuttleScheduleRecord[]> {
    const schedules = await this.prisma.shuttleSchedule.findMany({
      where: { routeId: input?.routeId },
      orderBy: { departure: "asc" }
    });
    return schedules.map(mapShuttleSchedule);
  }

  async findById(id: string): Promise<ShuttleScheduleRecord | null> {
    const schedule = await this.prisma.shuttleSchedule.findUnique({ where: { id } });
    return schedule ? mapShuttleSchedule(schedule) : null;
  }

  async create(input: ShuttleScheduleCreateInput): Promise<ShuttleScheduleRecord> {
    const schedule = await this.prisma.shuttleSchedule.create({
      data: {
        routeId: input.routeId,
        departure: new Date(input.departure),
        seats: input.seats ?? 8
      }
    });
    return mapShuttleSchedule(schedule);
  }

  async update(
    id: string,
    input: ShuttleScheduleUpdateInput
  ): Promise<ShuttleScheduleRecord | null> {
    try {
      const schedule = await this.prisma.shuttleSchedule.update({
        where: { id },
        data: {
          departure: input.departure ? new Date(input.departure) : undefined,
          seats: input.seats,
          bookedSeats: input.bookedSeats
        }
      });
      return mapShuttleSchedule(schedule);
    } catch {
      return null;
    }
  }

  async reserveSeat(id: string): Promise<ShuttleScheduleRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.shuttleSchedule.findUnique({ where: { id } });
      if (!schedule || schedule.bookedSeats >= schedule.seats) {
        return null;
      }

      const updated = await tx.shuttleSchedule.update({
        where: { id },
        data: {
          bookedSeats: { increment: 1 }
        }
      });
      return mapShuttleSchedule(updated);
    });
  }

  async releaseSeat(id: string): Promise<ShuttleScheduleRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.shuttleSchedule.findUnique({ where: { id } });
      if (!schedule) {
        return null;
      }
      if (schedule.bookedSeats === 0) {
        return mapShuttleSchedule(schedule);
      }

      const updated = await tx.shuttleSchedule.update({
        where: { id },
        data: {
          bookedSeats: { decrement: 1 }
        }
      });
      return mapShuttleSchedule(updated);
    });
  }
}

function mapDriveProfile(profile: DriveProfile): DriveProfileRecord {
  return {
    workerId: profile.workerId,
    maxReturnWalkMeters: profile.maxReturnWalkMeters
  };
}

function mapCargoProfile(profile: CargoProfile): CargoProfileRecord {
  return {
    workerId: profile.workerId,
    canLoadingHelp: profile.canLoadingHelp,
    hasForklift: profile.hasForklift,
    businessRegNo: profile.businessRegNo
  };
}

function mapShuttleRoute(route: ShuttleRoute): ShuttleRouteRecord {
  return {
    id: route.id,
    name: route.name,
    regionCode: route.regionCode,
    isActive: route.isActive,
    waypoints: Array.isArray(route.waypoints)
      ? (route.waypoints as unknown as ShuttleRouteRecord["waypoints"])
      : [],
    createdAt: route.createdAt.toISOString()
  };
}

function mapShuttleSchedule(schedule: ShuttleSchedule): ShuttleScheduleRecord {
  return {
    id: schedule.id,
    routeId: schedule.routeId,
    departure: schedule.departure.toISOString(),
    seats: schedule.seats,
    bookedSeats: schedule.bookedSeats
  };
}
