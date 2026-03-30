import {
  Prisma,
  PrismaClient,
  type Customer,
  type Favorite,
  type CustomerVehicle,
  type ModuleType as PrismaModuleType,
  type VehicleType as PrismaVehicleType,
  type Worker,
  type WorkerStatus as PrismaWorkerStatus
} from "@prisma/client";
import type {
  CustomerFavoriteCreateInput,
  CustomerFavoriteRecord,
  CustomerFavoriteUpdateInput,
  DeviceTokenUpdateInput,
  CustomerProfileUpdateInput,
  CustomerRecord,
  CustomerVehicleCreateInput,
  CustomerVehicleRecord,
  CustomerVehicleUpdateInput,
  CustomerRegistrationInput,
  WorkerRecord,
  WorkerRegistrationInput,
  WorkerStatus
} from "../auth/types.js";
import type {
  NearbyWorkerCandidate,
  NearbyWorkerSearchInput,
  CustomerStore,
  CustomerFavoriteStore,
  CustomerVehicleStore,
  WorkerStore
} from "../auth/store.js";

export class PrismaWorkerStore implements WorkerStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: WorkerRegistrationInput): Promise<WorkerRecord> {
    const worker = await this.prisma.worker.create({
      data: {
        phone: input.phone,
        name: input.name,
        module: input.module as PrismaModuleType,
        vehicleType: input.vehicleType as PrismaVehicleType,
        vehicleNumber: input.vehicleNumber
      }
    });

    return mapWorker(worker);
  }

  async findByPhone(phone: string): Promise<WorkerRecord | null> {
    const worker = await this.prisma.worker.findUnique({
      where: { phone }
    });
    return worker ? mapWorker(worker) : null;
  }

  async findById(id: string): Promise<WorkerRecord | null> {
    const worker = await this.prisma.worker.findUnique({
      where: { id }
    });
    return worker ? mapWorker(worker) : null;
  }

  async list(filters?: {
    module?: WorkerRecord["module"];
    status?: WorkerStatus;
  }): Promise<WorkerRecord[]> {
    const workers = await this.prisma.worker.findMany({
      where: {
        module: filters?.module as PrismaModuleType | undefined,
        status: filters?.status as PrismaWorkerStatus | undefined
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return workers.map(mapWorker);
  }

  async findNearbyCandidates(
    input: NearbyWorkerSearchInput
  ): Promise<NearbyWorkerCandidate[]> {
    const vehicleFilter =
      input.vehicleTypeFilter && input.vehicleTypeFilter.length > 0
        ? Prisma.sql`AND "vehicleType" IN (${Prisma.join(input.vehicleTypeFilter)})`
        : Prisma.empty;
    const rows = await this.prisma.$queryRaw<RawNearbyWorker[]>`
      SELECT
        "id" AS "workerId",
        "lat",
        "lng",
        ST_DistanceSphere(
          ST_MakePoint("lng", "lat"),
          ST_MakePoint(${input.originLng}, ${input.originLat})
        ) AS "distanceMeters"
      FROM "Worker"
      WHERE "module" = ${input.module as PrismaModuleType}
        AND "status" = 'ACTIVE'
        AND "isOnline" = true
        AND "lat" IS NOT NULL
        AND "lng" IS NOT NULL
        ${vehicleFilter}
        AND ST_DistanceSphere(
          ST_MakePoint("lng", "lat"),
          ST_MakePoint(${input.originLng}, ${input.originLat})
        ) <= ${input.radiusMeters}
      ORDER BY "distanceMeters" ASC
      LIMIT ${input.limit ?? 5}
    `;

    return rows.map((row) => ({
      workerId: row.workerId,
      distanceMeters: Number(row.distanceMeters),
      etaSeconds: Math.round(Number(row.distanceMeters) / 8.33),
      lat: Number(row.lat),
      lng: Number(row.lng)
    }));
  }

  async updateStatus(
    id: string,
    status: WorkerStatus
  ): Promise<WorkerRecord | null> {
    try {
      const worker = await this.prisma.worker.update({
        where: { id },
        data: {
          status: status as PrismaWorkerStatus
        }
      });

      return mapWorker(worker);
    } catch {
      return null;
    }
  }

  async updatePresence(
    id: string,
    input: {
      isOnline: boolean;
      lat: number | null;
      lng: number | null;
    }
  ): Promise<WorkerRecord | null> {
    try {
      const worker = await this.prisma.worker.update({
        where: { id },
        data: {
          isOnline: input.isOnline,
          lat: input.lat,
          lng: input.lng,
          lastSeenAt: new Date()
        }
      });
      return mapWorker(worker);
    } catch {
      return null;
    }
  }

  async updateDeviceToken(
    id: string,
    input: DeviceTokenUpdateInput
  ): Promise<WorkerRecord | null> {
    try {
      const worker = await this.prisma.worker.update({
        where: { id },
        data: {
          fcmToken: input.fcmToken
        }
      });

      return mapWorker(worker);
    } catch {
      return null;
    }
  }
}

export class PrismaCustomerStore implements CustomerStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CustomerRegistrationInput): Promise<CustomerRecord> {
    const customer = await this.prisma.customer.create({
      data: {
        phone: input.phone,
        name: input.name
      }
    });

    return mapCustomer(customer);
  }

  async findByPhone(phone: string): Promise<CustomerRecord | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { phone }
    });
    return customer ? mapCustomer(customer) : null;
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id }
    });
    return customer ? mapCustomer(customer) : null;
  }

  async updateProfile(
    id: string,
    input: CustomerProfileUpdateInput
  ): Promise<CustomerRecord | null> {
    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: {
          name: input.name,
          elderlyMode: input.elderlyMode
        }
      });
      return mapCustomer(customer);
    } catch {
      return null;
    }
  }

  async updateDeviceToken(
    id: string,
    input: DeviceTokenUpdateInput
  ): Promise<CustomerRecord | null> {
    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: {
          fcmToken: input.fcmToken
        }
      });

      return mapCustomer(customer);
    } catch {
      return null;
    }
  }
}

export class PrismaCustomerVehicleStore implements CustomerVehicleStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listByCustomer(customerId: string): Promise<CustomerVehicleRecord[]> {
    const vehicles = await this.prisma.customerVehicle.findMany({
      where: { customerId },
      orderBy: {
        createdAt: "asc"
      }
    });

    return vehicles.map(mapCustomerVehicle);
  }

  async createForCustomer(
    customerId: string,
    input: CustomerVehicleCreateInput
  ): Promise<CustomerVehicleRecord> {
    return this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.customerVehicle.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false }
        });
      }

      const vehicle = await tx.customerVehicle.create({
        data: {
          customerId,
          label: input.label,
          carNumber: input.carNumber,
          carModel: input.carModel,
          isDefault: input.isDefault ?? false
        }
      });

      return mapCustomerVehicle(vehicle);
    });
  }

  async updateForCustomer(
    customerId: string,
    vehicleId: string,
    input: CustomerVehicleUpdateInput
  ): Promise<CustomerVehicleRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const existingVehicle = await tx.customerVehicle.findFirst({
        where: {
          id: vehicleId,
          customerId
        }
      });
      if (!existingVehicle) {
        return null;
      }

      if (input.isDefault) {
        await tx.customerVehicle.updateMany({
          where: { customerId, isDefault: true },
          data: { isDefault: false }
        });
      }

      const vehicle = await tx.customerVehicle.update({
        where: { id: vehicleId },
        data: {
          label: input.label,
          carNumber: input.carNumber,
          carModel: input.carModel,
          isDefault: input.isDefault
        }
      });

      return mapCustomerVehicle(vehicle);
    });
  }

  async deleteForCustomer(customerId: string, vehicleId: string): Promise<boolean> {
    const vehicle = await this.prisma.customerVehicle.findFirst({
      where: {
        id: vehicleId,
        customerId
      }
    });
    if (!vehicle) {
      return false;
    }

    await this.prisma.customerVehicle.delete({
      where: { id: vehicleId }
    });
    return true;
  }
}

export class PrismaCustomerFavoriteStore implements CustomerFavoriteStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listByCustomer(customerId: string): Promise<CustomerFavoriteRecord[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { customerId },
      orderBy: {
        createdAt: "asc"
      }
    });

    return favorites.map(mapCustomerFavorite);
  }

  async createForCustomer(
    customerId: string,
    input: CustomerFavoriteCreateInput
  ): Promise<CustomerFavoriteRecord> {
    const favorite = await this.prisma.favorite.create({
      data: {
        customerId,
        label: input.label,
        lat: input.lat,
        lng: input.lng,
        address: input.address
      }
    });

    return mapCustomerFavorite(favorite);
  }

  async updateForCustomer(
    customerId: string,
    favoriteId: string,
    input: CustomerFavoriteUpdateInput
  ): Promise<CustomerFavoriteRecord | null> {
    const favorite = await this.prisma.favorite.findFirst({
      where: {
        id: favoriteId,
        customerId
      }
    });
    if (!favorite) {
      return null;
    }

    const updated = await this.prisma.favorite.update({
      where: {
        id: favoriteId
      },
      data: {
        label: input.label,
        lat: input.lat,
        lng: input.lng,
        address: input.address
      }
    });

    return mapCustomerFavorite(updated);
  }

  async deleteForCustomer(customerId: string, favoriteId: string): Promise<boolean> {
    const favorite = await this.prisma.favorite.findFirst({
      where: {
        id: favoriteId,
        customerId
      }
    });
    if (!favorite) {
      return false;
    }

    await this.prisma.favorite.delete({
      where: { id: favoriteId }
    });
    return true;
  }
}

function mapWorker(worker: Worker): WorkerRecord {
  return {
    id: worker.id,
    phone: worker.phone,
    name: worker.name,
    fcmToken: worker.fcmToken,
    module: worker.module as WorkerRecord["module"],
    vehicleType: worker.vehicleType as WorkerRecord["vehicleType"],
    vehicleNumber: worker.vehicleNumber,
    status: worker.status as WorkerStatus,
    isOnline: worker.isOnline,
    lat: worker.lat,
    lng: worker.lng,
    lastSeenAt: worker.lastSeenAt?.toISOString() ?? null,
    createdAt: worker.createdAt.toISOString()
  };
}

interface RawNearbyWorker {
  workerId: string;
  distanceMeters: number;
  lat: number;
  lng: number;
}

function mapCustomer(customer: Customer): CustomerRecord {
  return {
    id: customer.id,
    phone: customer.phone,
    name: customer.name ?? "",
    fcmToken: customer.fcmToken,
    elderlyMode: customer.elderlyMode,
    createdAt: customer.createdAt.toISOString()
  };
}

function mapCustomerVehicle(vehicle: CustomerVehicle): CustomerVehicleRecord {
  return {
    id: vehicle.id,
    customerId: vehicle.customerId,
    label: vehicle.label,
    carNumber: vehicle.carNumber,
    carModel: vehicle.carModel,
    isDefault: vehicle.isDefault,
    createdAt: vehicle.createdAt.toISOString()
  };
}

function mapCustomerFavorite(favorite: Favorite): CustomerFavoriteRecord {
  return {
    id: favorite.id,
    customerId: favorite.customerId,
    label: favorite.label,
    lat: favorite.lat,
    lng: favorite.lng,
    address: favorite.address,
    createdAt: favorite.createdAt.toISOString()
  };
}
