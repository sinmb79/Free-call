import type { CustomerStore, CustomerVehicleStore } from "./store.js";
import type {
  CustomerVehicleCreateInput,
  CustomerVehicleRecord,
  CustomerVehicleUpdateInput
} from "./types.js";

export class CustomerVehicleError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export interface CustomerVehicleServiceDependencies {
  customerStore: CustomerStore;
  customerVehicleStore: CustomerVehicleStore;
}

export class CustomerVehicleService {
  constructor(private readonly deps: CustomerVehicleServiceDependencies) {}

  async list(customerId: string): Promise<CustomerVehicleRecord[]> {
    await this.assertCustomer(customerId);
    return this.deps.customerVehicleStore.listByCustomer(customerId);
  }

  async create(
    customerId: string,
    input: CustomerVehicleCreateInput
  ): Promise<CustomerVehicleRecord> {
    await this.assertCustomer(customerId);
    return this.deps.customerVehicleStore.createForCustomer(customerId, input);
  }

  async update(
    customerId: string,
    vehicleId: string,
    input: CustomerVehicleUpdateInput
  ): Promise<CustomerVehicleRecord> {
    await this.assertCustomer(customerId);
    const vehicle = await this.deps.customerVehicleStore.updateForCustomer(
      customerId,
      vehicleId,
      input
    );
    if (!vehicle) {
      throw new CustomerVehicleError("Vehicle not found", 404);
    }

    return vehicle;
  }

  async delete(customerId: string, vehicleId: string): Promise<void> {
    await this.assertCustomer(customerId);
    const deleted = await this.deps.customerVehicleStore.deleteForCustomer(
      customerId,
      vehicleId
    );
    if (!deleted) {
      throw new CustomerVehicleError("Vehicle not found", 404);
    }
  }

  private async assertCustomer(customerId: string): Promise<void> {
    const customer = await this.deps.customerStore.findById(customerId);
    if (!customer) {
      throw new CustomerVehicleError("Customer not found", 404);
    }
  }
}
