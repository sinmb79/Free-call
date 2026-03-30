import { ModuleType } from "@iwootcall/shared";
import type { CustomerStore } from "../auth/store.js";
import type { JobService } from "../jobs/job.service.js";
import type {
  ShuttleBookingInput,
  ShuttleBookingResult,
  ShuttleRouteCreateInput,
  ShuttleRouteRecord,
  ShuttleRouteUpdateInput,
  ShuttleScheduleCreateInput,
  ShuttleScheduleRecord,
  ShuttleScheduleUpdateInput
} from "./types.js";
import type { ShuttleRouteStore, ShuttleScheduleStore } from "./store.js";

export class ShuttleServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export class ShuttleService {
  constructor(
    private readonly customerStore: Pick<CustomerStore, "findById">,
    private readonly shuttleRouteStore: ShuttleRouteStore,
    private readonly shuttleScheduleStore: ShuttleScheduleStore,
    private readonly jobService: JobService
  ) {}

  listRoutes(activeOnly = false): Promise<ShuttleRouteRecord[]> {
    return this.shuttleRouteStore.list(activeOnly ? { isActive: true } : undefined);
  }

  createRoute(input: ShuttleRouteCreateInput): Promise<ShuttleRouteRecord> {
    return this.shuttleRouteStore.create(input);
  }

  async updateRoute(
    routeId: string,
    input: ShuttleRouteUpdateInput
  ): Promise<ShuttleRouteRecord> {
    const route = await this.shuttleRouteStore.update(routeId, input);
    if (!route) {
      throw new ShuttleServiceError("Shuttle route not found", 404);
    }

    return route;
  }

  async listSchedules(routeId?: string): Promise<ShuttleScheduleRecord[]> {
    if (routeId) {
      await this.assertRoute(routeId);
    }
    return this.shuttleScheduleStore.list(routeId ? { routeId } : undefined);
  }

  async createSchedule(
    input: ShuttleScheduleCreateInput
  ): Promise<ShuttleScheduleRecord> {
    await this.assertRoute(input.routeId);
    return this.shuttleScheduleStore.create(input);
  }

  async updateSchedule(
    scheduleId: string,
    input: ShuttleScheduleUpdateInput
  ): Promise<ShuttleScheduleRecord> {
    const schedule = await this.shuttleScheduleStore.update(scheduleId, input);
    if (!schedule) {
      throw new ShuttleServiceError("Shuttle schedule not found", 404);
    }

    return schedule;
  }

  async bookSeat(
    customerId: string,
    input: ShuttleBookingInput
  ): Promise<ShuttleBookingResult> {
    const customer = await this.customerStore.findById(customerId);
    if (!customer) {
      throw new ShuttleServiceError("Customer not found", 404);
    }

    const route = await this.assertRoute(input.routeId);
    if (!route.isActive) {
      throw new ShuttleServiceError("Shuttle route is not active", 409);
    }

    const schedule = await this.shuttleScheduleStore.findById(input.scheduleId);
    if (!schedule || schedule.routeId !== input.routeId) {
      throw new ShuttleServiceError("Shuttle schedule not found", 404);
    }
    if (schedule.bookedSeats >= schedule.seats) {
      throw new ShuttleServiceError("Shuttle schedule is full", 409);
    }

    const reservedSchedule = await this.shuttleScheduleStore.reserveSeat(schedule.id);
    if (!reservedSchedule) {
      throw new ShuttleServiceError("Shuttle schedule is full", 409);
    }

    try {
      const job = await this.jobService.createJob({
        customerId,
        module: ModuleType.FREESHUTTLE,
        originLat: input.originLat,
        originLng: input.originLng,
        originAddress: input.originAddress,
        metadata: {
          routeId: route.id,
          scheduleId: schedule.id
        }
      });

      return {
        job,
        schedule: reservedSchedule
      };
    } catch (error) {
      await this.shuttleScheduleStore.releaseSeat(schedule.id);
      throw error;
    }
  }

  private async assertRoute(routeId: string): Promise<ShuttleRouteRecord> {
    const route = await this.shuttleRouteStore.findById(routeId);
    if (!route) {
      throw new ShuttleServiceError("Shuttle route not found", 404);
    }

    return route;
  }
}
