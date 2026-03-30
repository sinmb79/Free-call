/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import { buildApp } from "./app.js";
import { loadConfig } from "./config/config.js";
import {
  PrismaCustomerFavoriteStore,
  PrismaCustomerStore,
  PrismaCustomerVehicleStore,
  PrismaWorkerStore
} from "./core/prisma/auth.repositories.js";
import { createPrismaClient } from "./core/prisma/client.js";
import { PrismaJobStore } from "./core/prisma/job.repositories.js";
import {
  PrismaCargoProfileStore,
  PrismaDriveProfileStore,
  PrismaShuttleRouteStore,
  PrismaShuttleScheduleStore
} from "./core/prisma/module.repositories.js";
import { DevOtpProvider } from "./core/auth/otp.js";
import {
  createBullMqDispatchRuntime,
  type DispatchOrchestrator
} from "./core/jobs/queue.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = createPrismaClient();
  let dispatchOrchestrator: DispatchOrchestrator | null = null;
  const bullMqRuntime = createBullMqDispatchRuntime(
    config.redisUrl,
    () => dispatchOrchestrator
  );
  const app = buildApp(config, {
    workerStore: new PrismaWorkerStore(prisma),
    customerStore: new PrismaCustomerStore(prisma),
    customerFavoriteStore: new PrismaCustomerFavoriteStore(prisma),
    customerVehicleStore: new PrismaCustomerVehicleStore(prisma),
    jobStore: new PrismaJobStore(prisma),
    driveProfileStore: new PrismaDriveProfileStore(prisma),
    cargoProfileStore: new PrismaCargoProfileStore(prisma),
    shuttleRouteStore: new PrismaShuttleRouteStore(prisma),
    shuttleScheduleStore: new PrismaShuttleScheduleStore(prisma),
    otpProvider: new DevOtpProvider(),
    dispatchQueue: bullMqRuntime.dispatchQueue,
    onDispatchOrchestratorReady(orchestrator) {
      dispatchOrchestrator = orchestrator;
    },
    onClose: async () => {
      await Promise.all([bullMqRuntime.close(), prisma.$disconnect()]);
    }
  });

  try {
    await app.listen({
      port: config.port,
      host: config.host
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
