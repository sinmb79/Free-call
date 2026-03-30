/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import { randomUUID } from "node:crypto";
import { type ModuleType, type VehicleType } from "@iwootcall/shared";
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
} from "./types.js";

export interface NearbyWorkerSearchInput {
  module: ModuleType;
  originLat: number;
  originLng: number;
  radiusMeters: number;
  vehicleTypeFilter?: VehicleType[];
  limit?: number;
}

export interface NearbyWorkerCandidate {
  workerId: string;
  distanceMeters: number;
  etaSeconds: number;
  lat: number;
  lng: number;
}

export interface WorkerStore {
  create(input: WorkerRegistrationInput): Promise<WorkerRecord>;
  findByPhone(phone: string): Promise<WorkerRecord | null>;
  findById(id: string): Promise<WorkerRecord | null>;
  list(filters?: {
    module?: WorkerRecord["module"];
    status?: WorkerStatus;
  }): Promise<WorkerRecord[]>;
  findNearbyCandidates?(
    input: NearbyWorkerSearchInput
  ): Promise<NearbyWorkerCandidate[]>;
  updateStatus(id: string, status: WorkerStatus): Promise<WorkerRecord | null>;
  updatePresence(
    id: string,
    input: {
      isOnline: boolean;
      lat: number | null;
      lng: number | null;
    }
  ): Promise<WorkerRecord | null>;
  updateDeviceToken(
    id: string,
    input: DeviceTokenUpdateInput
  ): Promise<WorkerRecord | null>;
}

export interface CustomerStore {
  create(input: CustomerRegistrationInput): Promise<CustomerRecord>;
  findByPhone(phone: string): Promise<CustomerRecord | null>;
  findById(id: string): Promise<CustomerRecord | null>;
  updateProfile(
    id: string,
    input: CustomerProfileUpdateInput
  ): Promise<CustomerRecord | null>;
  updateDeviceToken(
    id: string,
    input: DeviceTokenUpdateInput
  ): Promise<CustomerRecord | null>;
}

export interface CustomerVehicleStore {
  listByCustomer(customerId: string): Promise<CustomerVehicleRecord[]>;
  createForCustomer(
    customerId: string,
    input: CustomerVehicleCreateInput
  ): Promise<CustomerVehicleRecord>;
  updateForCustomer(
    customerId: string,
    vehicleId: string,
    input: CustomerVehicleUpdateInput
  ): Promise<CustomerVehicleRecord | null>;
  deleteForCustomer(customerId: string, vehicleId: string): Promise<boolean>;
}

export interface CustomerFavoriteStore {
  listByCustomer(customerId: string): Promise<CustomerFavoriteRecord[]>;
  createForCustomer(
    customerId: string,
    input: CustomerFavoriteCreateInput
  ): Promise<CustomerFavoriteRecord>;
  updateForCustomer(
    customerId: string,
    favoriteId: string,
    input: CustomerFavoriteUpdateInput
  ): Promise<CustomerFavoriteRecord | null>;
  deleteForCustomer(customerId: string, favoriteId: string): Promise<boolean>;
}

export class InMemoryWorkerStore implements WorkerStore {
  private readonly workers = new Map<string, WorkerRecord>();

  async create(input: WorkerRegistrationInput): Promise<WorkerRecord> {
    const worker: WorkerRecord = {
      id: randomUUID(),
      phone: input.phone,
      name: input.name,
      fcmToken: null,
      module: input.module,
      vehicleType: input.vehicleType,
      vehicleNumber: input.vehicleNumber,
      status: "PENDING",
      isOnline: false,
      lat: null,
      lng: null,
      lastSeenAt: null,
      createdAt: new Date().toISOString()
    };

    this.workers.set(worker.id, worker);
    return worker;
  }

  async findByPhone(phone: string): Promise<WorkerRecord | null> {
    for (const worker of this.workers.values()) {
      if (worker.phone === phone) {
        return worker;
      }
    }

    return null;
  }

  async findById(id: string): Promise<WorkerRecord | null> {
    return this.workers.get(id) ?? null;
  }

  async list(filters?: {
    module?: WorkerRecord["module"];
    status?: WorkerStatus;
  }): Promise<WorkerRecord[]> {
    return Array.from(this.workers.values()).filter((worker) => {
      if (filters?.module && worker.module !== filters.module) {
        return false;
      }

      if (filters?.status && worker.status !== filters.status) {
        return false;
      }

      return true;
    });
  }

  async updateStatus(
    id: string,
    status: WorkerStatus
  ): Promise<WorkerRecord | null> {
    const worker = this.workers.get(id);
    if (!worker) {
      return null;
    }

    const updatedWorker = {
      ...worker,
      status
    };
    this.workers.set(id, updatedWorker);
    return updatedWorker;
  }

  async updatePresence(
    id: string,
    input: {
      isOnline: boolean;
      lat: number | null;
      lng: number | null;
    }
  ): Promise<WorkerRecord | null> {
    const worker = this.workers.get(id);
    if (!worker) {
      return null;
    }

    const updatedWorker = {
      ...worker,
      isOnline: input.isOnline,
      lat: input.lat,
      lng: input.lng,
      lastSeenAt: new Date().toISOString()
    };
    this.workers.set(id, updatedWorker);
    return updatedWorker;
  }

  async updateDeviceToken(
    id: string,
    input: DeviceTokenUpdateInput
  ): Promise<WorkerRecord | null> {
    const worker = this.workers.get(id);
    if (!worker) {
      return null;
    }

    const updatedWorker = {
      ...worker,
      fcmToken: input.fcmToken
    };
    this.workers.set(id, updatedWorker);
    return updatedWorker;
  }
}

export class InMemoryCustomerStore implements CustomerStore {
  private readonly customers = new Map<string, CustomerRecord>();

  async create(input: CustomerRegistrationInput): Promise<CustomerRecord> {
    const customer: CustomerRecord = {
      id: randomUUID(),
      phone: input.phone,
      name: input.name,
      fcmToken: null,
      elderlyMode: false,
      createdAt: new Date().toISOString()
    };

    this.customers.set(customer.id, customer);
    return customer;
  }

  async findByPhone(phone: string): Promise<CustomerRecord | null> {
    for (const customer of this.customers.values()) {
      if (customer.phone === phone) {
        return customer;
      }
    }

    return null;
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    return this.customers.get(id) ?? null;
  }

  async updateProfile(
    id: string,
    input: CustomerProfileUpdateInput
  ): Promise<CustomerRecord | null> {
    const customer = this.customers.get(id);
    if (!customer) {
      return null;
    }

    const updatedCustomer: CustomerRecord = {
      ...customer,
      name: input.name ?? customer.name,
      elderlyMode: input.elderlyMode ?? customer.elderlyMode
    };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async updateDeviceToken(
    id: string,
    input: DeviceTokenUpdateInput
  ): Promise<CustomerRecord | null> {
    const customer = this.customers.get(id);
    if (!customer) {
      return null;
    }

    const updatedCustomer: CustomerRecord = {
      ...customer,
      fcmToken: input.fcmToken
    };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }
}

export class InMemoryCustomerVehicleStore implements CustomerVehicleStore {
  private readonly vehicles = new Map<string, CustomerVehicleRecord>();

  async listByCustomer(customerId: string): Promise<CustomerVehicleRecord[]> {
    return Array.from(this.vehicles.values()).filter(
      (vehicle) => vehicle.customerId === customerId
    );
  }

  async createForCustomer(
    customerId: string,
    input: CustomerVehicleCreateInput
  ): Promise<CustomerVehicleRecord> {
    if (input.isDefault) {
      await this.clearDefault(customerId);
    }

    const vehicle: CustomerVehicleRecord = {
      id: randomUUID(),
      customerId,
      label: input.label,
      carNumber: input.carNumber,
      carModel: input.carModel ?? null,
      isDefault: input.isDefault ?? false,
      createdAt: new Date().toISOString()
    };

    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  async updateForCustomer(
    customerId: string,
    vehicleId: string,
    input: CustomerVehicleUpdateInput
  ): Promise<CustomerVehicleRecord | null> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle || vehicle.customerId !== customerId) {
      return null;
    }

    if (input.isDefault) {
      await this.clearDefault(customerId);
    }

    const updatedVehicle: CustomerVehicleRecord = {
      ...vehicle,
      label: input.label ?? vehicle.label,
      carNumber: input.carNumber ?? vehicle.carNumber,
      carModel:
        input.carModel === undefined ? vehicle.carModel : input.carModel,
      isDefault: input.isDefault ?? vehicle.isDefault
    };

    this.vehicles.set(vehicleId, updatedVehicle);
    return updatedVehicle;
  }

  async deleteForCustomer(
    customerId: string,
    vehicleId: string
  ): Promise<boolean> {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle || vehicle.customerId !== customerId) {
      return false;
    }

    this.vehicles.delete(vehicleId);
    return true;
  }

  private async clearDefault(customerId: string): Promise<void> {
    for (const [vehicleId, vehicle] of this.vehicles.entries()) {
      if (vehicle.customerId === customerId && vehicle.isDefault) {
        this.vehicles.set(vehicleId, {
          ...vehicle,
          isDefault: false
        });
      }
    }
  }
}

export class InMemoryCustomerFavoriteStore implements CustomerFavoriteStore {
  private readonly favorites = new Map<string, CustomerFavoriteRecord>();

  async listByCustomer(customerId: string): Promise<CustomerFavoriteRecord[]> {
    return Array.from(this.favorites.values()).filter(
      (favorite) => favorite.customerId === customerId
    );
  }

  async createForCustomer(
    customerId: string,
    input: CustomerFavoriteCreateInput
  ): Promise<CustomerFavoriteRecord> {
    const favorite: CustomerFavoriteRecord = {
      id: randomUUID(),
      customerId,
      label: input.label,
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      createdAt: new Date().toISOString()
    };

    this.favorites.set(favorite.id, favorite);
    return favorite;
  }

  async updateForCustomer(
    customerId: string,
    favoriteId: string,
    input: CustomerFavoriteUpdateInput
  ): Promise<CustomerFavoriteRecord | null> {
    const favorite = this.favorites.get(favoriteId);
    if (!favorite || favorite.customerId !== customerId) {
      return null;
    }

    const updatedFavorite: CustomerFavoriteRecord = {
      ...favorite,
      label: input.label ?? favorite.label,
      lat: input.lat ?? favorite.lat,
      lng: input.lng ?? favorite.lng,
      address: input.address ?? favorite.address
    };
    this.favorites.set(favoriteId, updatedFavorite);
    return updatedFavorite;
  }

  async deleteForCustomer(
    customerId: string,
    favoriteId: string
  ): Promise<boolean> {
    const favorite = this.favorites.get(favoriteId);
    if (!favorite || favorite.customerId !== customerId) {
      return false;
    }

    this.favorites.delete(favoriteId);
    return true;
  }
}
