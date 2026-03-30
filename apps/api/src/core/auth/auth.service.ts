/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import type { ModuleType } from "@iwootcall/shared";
import type { AppConfig } from "../../config/config.js";
import { createAccessToken } from "../../lib/token.js";
import type { CustomerStore, WorkerStore } from "./store.js";
import type { OtpProvider } from "./otp.js";
import type {
  CustomerLoginInput,
  CustomerRegistrationInput,
  CustomerRecord,
  WorkerLoginInput,
  WorkerRecord,
  WorkerRegistrationInput
} from "./types.js";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export interface AuthServiceDependencies {
  config: AppConfig;
  workerStore: WorkerStore;
  customerStore: CustomerStore;
  otpProvider: OtpProvider;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDependencies) {}

  async registerWorker(input: WorkerRegistrationInput): Promise<WorkerRecord> {
    await this.assertOtp(input.phone, input.otpCode);
    this.assertEnabledModule(input.module);

    const existingWorker = await this.deps.workerStore.findByPhone(input.phone);
    if (existingWorker) {
      throw new AuthError("Worker already registered", 409);
    }

    return this.deps.workerStore.create(input);
  }

  async loginWorker(input: WorkerLoginInput): Promise<{
    token: string;
    worker: WorkerRecord;
  }> {
    await this.assertOtp(input.phone, input.otpCode);

    const worker = await this.deps.workerStore.findByPhone(input.phone);
    if (!worker) {
      throw new AuthError("Worker not found", 404);
    }

    const token = await createAccessToken(
      {
        sub: worker.id,
        role: "worker",
        phone: worker.phone,
        module: worker.module
      },
      this.deps.config.jwtSecret
    );

    return { token, worker };
  }

  async registerCustomer(
    input: CustomerRegistrationInput
  ): Promise<CustomerRecord> {
    await this.assertOtp(input.phone, input.otpCode);

    const existingCustomer = await this.deps.customerStore.findByPhone(
      input.phone
    );
    if (existingCustomer) {
      throw new AuthError("Customer already registered", 409);
    }

    return this.deps.customerStore.create(input);
  }

  async loginCustomer(input: CustomerLoginInput): Promise<{
    token: string;
    customer: CustomerRecord;
  }> {
    await this.assertOtp(input.phone, input.otpCode);

    const customer = await this.deps.customerStore.findByPhone(input.phone);
    if (!customer) {
      throw new AuthError("Customer not found", 404);
    }

    const token = await createAccessToken(
      {
        sub: customer.id,
        role: "customer",
        phone: customer.phone
      },
      this.deps.config.jwtSecret
    );

    return { token, customer };
  }

  private assertEnabledModule(module: ModuleType): void {
    if (!this.deps.config.enabledModules.includes(module)) {
      throw new AuthError(`Module is not enabled: ${module}`, 400);
    }
  }

  private async assertOtp(phone: string, otpCode: string): Promise<void> {
    const isValid = await this.deps.otpProvider.verify(phone, otpCode);
    if (!isValid) {
      throw new AuthError("Invalid OTP code", 401);
    }
  }
}
