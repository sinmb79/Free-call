import type {
  CustomerFavoriteCreateInput,
  CustomerFavoriteRecord,
  CustomerFavoriteUpdateInput,
  DeviceTokenUpdateInput,
  CustomerProfileUpdateInput,
  CustomerRecord
} from "./types.js";
import type {
  CustomerFavoriteStore,
  CustomerStore
} from "./store.js";

export class CustomerProfileError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export interface CustomerProfileServiceDependencies {
  customerStore: CustomerStore;
  customerFavoriteStore: CustomerFavoriteStore;
}

export class CustomerProfileService {
  constructor(private readonly deps: CustomerProfileServiceDependencies) {}

  async getProfile(customerId: string): Promise<CustomerRecord> {
    return this.assertCustomer(customerId);
  }

  async updateProfile(
    customerId: string,
    input: CustomerProfileUpdateInput
  ): Promise<CustomerRecord> {
    await this.assertCustomer(customerId);
    const customer = await this.deps.customerStore.updateProfile(customerId, input);
    if (!customer) {
      throw new CustomerProfileError("Customer not found", 404);
    }

    return customer;
  }

  async updateDeviceToken(
    customerId: string,
    input: DeviceTokenUpdateInput
  ): Promise<CustomerRecord> {
    await this.assertCustomer(customerId);
    const customer = await this.deps.customerStore.updateDeviceToken(
      customerId,
      input
    );
    if (!customer) {
      throw new CustomerProfileError("Customer not found", 404);
    }

    return customer;
  }

  async listFavorites(customerId: string): Promise<CustomerFavoriteRecord[]> {
    await this.assertCustomer(customerId);
    return this.deps.customerFavoriteStore.listByCustomer(customerId);
  }

  async createFavorite(
    customerId: string,
    input: CustomerFavoriteCreateInput
  ): Promise<CustomerFavoriteRecord> {
    await this.assertCustomer(customerId);
    return this.deps.customerFavoriteStore.createForCustomer(customerId, input);
  }

  async updateFavorite(
    customerId: string,
    favoriteId: string,
    input: CustomerFavoriteUpdateInput
  ): Promise<CustomerFavoriteRecord> {
    await this.assertCustomer(customerId);
    const favorite = await this.deps.customerFavoriteStore.updateForCustomer(
      customerId,
      favoriteId,
      input
    );
    if (!favorite) {
      throw new CustomerProfileError("Favorite not found", 404);
    }

    return favorite;
  }

  async deleteFavorite(customerId: string, favoriteId: string): Promise<void> {
    await this.assertCustomer(customerId);
    const deleted = await this.deps.customerFavoriteStore.deleteForCustomer(
      customerId,
      favoriteId
    );
    if (!deleted) {
      throw new CustomerProfileError("Favorite not found", 404);
    }
  }

  private async assertCustomer(customerId: string): Promise<CustomerRecord> {
    const customer = await this.deps.customerStore.findById(customerId);
    if (!customer) {
      throw new CustomerProfileError("Customer not found", 404);
    }

    return customer;
  }
}
