/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { AppConfig } from "./config/config.js";
import { AdminStatsService } from "./core/admin/admin-stats.service.js";
import { AuthService } from "./core/auth/auth.service.js";
import { CustomerProfileService } from "./core/auth/customer-profile.service.js";
import { CustomerVehicleService } from "./core/auth/customer-vehicle.service.js";
import { DevOtpProvider } from "./core/auth/otp.js";
import type { OtpProvider } from "./core/auth/otp.js";
import {
  type CustomerFavoriteStore,
  type CustomerStore,
  type CustomerVehicleStore,
  InMemoryCustomerFavoriteStore,
  InMemoryCustomerVehicleStore,
  InMemoryCustomerStore,
  InMemoryWorkerStore,
  type WorkerStore
} from "./core/auth/store.js";
import { DispatchEngine, type DispatchEventSink } from "./core/dispatch/dispatch.engine.js";
import { JobQueryService } from "./core/jobs/job-query.service.js";
import { JobService } from "./core/jobs/job.service.js";
import {
  DispatchOrchestrator,
  InlineDispatchQueue,
  type DispatchQueue
} from "./core/jobs/queue.js";
import { InMemoryJobStore, type JobStore } from "./core/jobs/store.js";
import {
  InMemoryCargoProfileStore,
  InMemoryDriveProfileStore,
  InMemoryShuttleRouteStore,
  InMemoryShuttleScheduleStore,
  type CargoProfileStore,
  type DriveProfileStore,
  type ShuttleRouteStore,
  type ShuttleScheduleStore
} from "./core/modules/store.js";
import { FreeRunService } from "./core/modules/freerun.service.js";
import { WorkerModuleProfileService } from "./core/modules/profile.service.js";
import { ShuttleService } from "./core/modules/shuttle.service.js";
import { createNotificationProviders } from "./core/notification/notification.factory.js";
import {
  NotificationDeliveryService
} from "./core/notification/notification.service.js";
import { NotificationDispatchEventSink } from "./core/notification/dispatch-notification-sink.js";
import { WorkerService } from "./core/worker/worker.service.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCustomerRoutes } from "./routes/customer.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerWorkerRoutes } from "./routes/worker.js";
import { SocketGateway } from "./realtime/socket.gateway.js";
import { WorkerJobService } from "./realtime/worker-job.service.js";

export interface AppDependencies {
  workerStore?: WorkerStore;
  customerStore?: CustomerStore;
  customerFavoriteStore?: CustomerFavoriteStore;
  customerVehicleStore?: CustomerVehicleStore;
  jobStore?: JobStore;
  driveProfileStore?: DriveProfileStore;
  cargoProfileStore?: CargoProfileStore;
  shuttleRouteStore?: ShuttleRouteStore;
  shuttleScheduleStore?: ShuttleScheduleStore;
  otpProvider?: OtpProvider;
  dispatchQueue?: DispatchQueue;
  dispatchEventSink?: DispatchEventSink;
  onDispatchOrchestratorReady?: (dispatchOrchestrator: DispatchOrchestrator) => void;
  onClose?: () => Promise<void>;
}

export function buildApp(
  config: AppConfig,
  dependencies: AppDependencies = {}
): FastifyInstance {
  const app = Fastify({
    logger: false
  });
  const allowedOrigins = config.corsOrigins ?? [
    "http://localhost:3101",
    "http://localhost:3102",
    "http://localhost:3103"
  ];

  void app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    }
  });
  const workerStore = dependencies.workerStore ?? new InMemoryWorkerStore();
  const customerStore = dependencies.customerStore ?? new InMemoryCustomerStore();
  const customerFavoriteStore =
    dependencies.customerFavoriteStore ?? new InMemoryCustomerFavoriteStore();
  const customerVehicleStore =
    dependencies.customerVehicleStore ?? new InMemoryCustomerVehicleStore();
  const jobStore = dependencies.jobStore ?? new InMemoryJobStore();
  const driveProfileStore =
    dependencies.driveProfileStore ?? new InMemoryDriveProfileStore();
  const cargoProfileStore =
    dependencies.cargoProfileStore ?? new InMemoryCargoProfileStore();
  const shuttleRouteStore =
    dependencies.shuttleRouteStore ?? new InMemoryShuttleRouteStore();
  const shuttleScheduleStore =
    dependencies.shuttleScheduleStore ?? new InMemoryShuttleScheduleStore();
  let socketGateway: SocketGateway | null = null;
  const notificationSink =
    dependencies.dispatchEventSink
      ? null
      : (() => {
          const providers = createNotificationProviders(config);
          return new NotificationDispatchEventSink(
            workerStore,
            customerStore,
            new NotificationDeliveryService(
              providers.pushProvider,
              providers.smsProvider
            )
          );
        })();
  const dispatchEventSink =
    dependencies.dispatchEventSink ??
    createCompositeDispatchEventSink(
      () => socketGateway,
      () => notificationSink
    );
  const dispatchEngine = new DispatchEngine(
    workerStore,
    jobStore,
    dispatchEventSink
  );
  let dispatchOrchestrator: DispatchOrchestrator | null = null;
  const dispatchQueue =
    dependencies.dispatchQueue ??
    new InlineDispatchQueue(async (jobId) => {
      if (!dispatchOrchestrator) {
        throw new Error("Dispatch orchestrator not initialized");
      }

      await dispatchOrchestrator.processDispatch(jobId);
    });
  dispatchOrchestrator = new DispatchOrchestrator(dispatchEngine, dispatchQueue);
  dependencies.onDispatchOrchestratorReady?.(dispatchOrchestrator);
  const authService = new AuthService({
    config,
    workerStore,
    customerStore,
    otpProvider: dependencies.otpProvider ?? new DevOtpProvider()
  });
  const customerVehicleService = new CustomerVehicleService({
    customerStore,
    customerVehicleStore
  });
  const customerProfileService = new CustomerProfileService({
    customerStore,
    customerFavoriteStore
  });
  const workerService = new WorkerService(workerStore);
  const workerModuleProfileService = new WorkerModuleProfileService(
    workerStore,
    driveProfileStore,
    cargoProfileStore
  );
  const jobQueryService = new JobQueryService(jobStore);
  const adminStatsService = new AdminStatsService(
    config.enabledModules,
    workerStore,
    jobStore
  );
  const workerJobService = new WorkerJobService(
    workerStore,
    jobStore,
    dispatchEngine,
    dispatchQueue,
    dispatchEventSink
  );
  if (!dependencies.dispatchEventSink) {
    socketGateway = new SocketGateway(app.server, config.jwtSecret, workerJobService);
  }
  const jobService = new JobService(jobStore, dispatchEngine, dispatchQueue);
  const freeRunService = new FreeRunService(jobService);
  const shuttleService = new ShuttleService(
    customerStore,
    shuttleRouteStore,
    shuttleScheduleStore,
    jobService
  );

  void registerHealthRoute(app, config);
  void registerAuthRoutes(app, authService);
  void registerAdminRoutes(
    app,
    workerStore,
    jobQueryService,
    adminStatsService,
    shuttleService,
    config.jwtSecret
  );
  void registerCustomerRoutes(
    app,
    customerProfileService,
    customerVehicleService,
    shuttleService,
    jobQueryService,
    config.jwtSecret
  );
  void registerJobRoutes(app, jobService, freeRunService, config.jwtSecret);
  void registerWorkerRoutes(
    app,
    workerService,
    workerModuleProfileService,
    jobQueryService,
    config.jwtSecret
  );
  if (socketGateway || dependencies.onClose) {
    app.addHook("onClose", async () => {
      await socketGateway?.close();
      await dependencies.onClose?.();
    });
  }

  return app;
}

function createCompositeDispatchEventSink(
  ...resolvers: Array<() => DispatchEventSink | null>
): DispatchEventSink {
  return {
    async emitIncomingCall(workerId, job) {
      for (const resolver of resolvers) {
        await resolver()?.emitIncomingCall(workerId, job);
      }
    },
    async emitDispatchFailed(job) {
      for (const resolver of resolvers) {
        await resolver()?.emitDispatchFailed(job);
      }
    },
    async emitWorkerAssigned(job, worker) {
      for (const resolver of resolvers) {
        await resolver()?.emitWorkerAssigned?.(job, worker);
      }
    },
    async emitWorkerLocation(job, worker) {
      for (const resolver of resolvers) {
        await resolver()?.emitWorkerLocation?.(job, worker);
      }
    },
    async emitWorkerArrived(job, worker) {
      for (const resolver of resolvers) {
        await resolver()?.emitWorkerArrived?.(job, worker);
      }
    },
    async emitJobStarted(job, worker) {
      for (const resolver of resolvers) {
        await resolver()?.emitJobStarted?.(job, worker);
      }
    },
    async emitJobCompleted(job, worker) {
      for (const resolver of resolvers) {
        await resolver()?.emitJobCompleted?.(job, worker);
      }
    }
  };
}
