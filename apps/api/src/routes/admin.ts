/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ModuleType } from "@iwootcall/shared";
import { AdminStatsService } from "../core/admin/admin-stats.service.js";
import { verifyAccessToken } from "../lib/token.js";
import type { WorkerStore } from "../core/auth/store.js";
import type { WorkerStatus } from "../core/auth/types.js";
import { JobQueryService } from "../core/jobs/job-query.service.js";
import { ShuttleService, ShuttleServiceError } from "../core/modules/shuttle.service.js";
import { JobStatus } from "../core/jobs/types.js";

const VALID_WORKER_STATUSES = new Set<WorkerStatus>([
  "PENDING",
  "ACTIVE",
  "SUSPENDED"
]);
const VALID_JOB_STATUSES = new Set(Object.values(JobStatus));
const VALID_STATS_RANGES = new Set(["today", "all"]);

export async function registerAdminRoutes(
  app: FastifyInstance,
  workerStore: WorkerStore,
  jobQueryService: JobQueryService,
  adminStatsService: AdminStatsService,
  shuttleService: ShuttleService,
  jwtSecret: string
): Promise<void> {
  app.get("/admin/workers", async (request, reply) => {
    const authorized = await requireAdmin(request, reply, jwtSecret);
    if (!authorized) {
      return;
    }

    const query = request.query as {
      module?: WorkerStore extends {
        list(filters?: infer T): Promise<unknown>;
      }
        ? T extends { module?: infer M }
          ? M
          : never
        : never;
      status?: WorkerStatus;
    };
    const workers = await workerStore.list({
      module: query.module,
      status: query.status
    });
    return { workers };
  });

  app.get("/admin/jobs", async (request, reply) => {
    const authorized = await requireAdmin(request, reply, jwtSecret);
    if (!authorized) {
      return;
    }

    const query = request.query as {
      status?: JobStatus;
      module?: ModuleType;
      workerId?: string;
      customerId?: string;
      limit?: string;
    };

    if (query.status && !VALID_JOB_STATUSES.has(query.status)) {
      reply.code(400);
      return { message: "Invalid job status" };
    }

    const jobs = await jobQueryService.listAdminJobs({
      status: query.status,
      module: query.module,
      workerId: query.workerId,
      customerId: query.customerId,
      limit: query.limit ? Number(query.limit) : undefined
    });
    return { jobs };
  });

  app.get("/admin/stats", async (request, reply) => {
    const authorized = await requireAdmin(request, reply, jwtSecret);
    if (!authorized) {
      return;
    }

    const query = request.query as {
      range?: "today" | "all";
    };
    const range = query.range ?? "today";
    if (!VALID_STATS_RANGES.has(range)) {
      reply.code(400);
      return { message: "Invalid stats range" };
    }

    return adminStatsService.getStats(range);
  });

  app.patch("/admin/workers/:id/status", async (request, reply) => {
    const authorized = await requireAdmin(request, reply, jwtSecret);
    if (!authorized) {
      return;
    }

    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: WorkerStatus };

    if (!status || !VALID_WORKER_STATUSES.has(status)) {
      reply.code(400);
      return { message: "Invalid worker status" };
    }

    const worker = await workerStore.updateStatus(id, status);
    if (!worker) {
      reply.code(404);
      return { message: "Worker not found" };
    }

    return { worker };
  });

  app.get("/admin/shuttle/routes", async (request, reply) => {
    try {
      const authorized = await requireAdmin(request, reply, jwtSecret);
      if (!authorized) {
        return;
      }

      const routes = await shuttleService.listRoutes(false);
      return { routes };
    } catch (error) {
      return handleAdminError(reply, error);
    }
  });

  app.post("/admin/shuttle/routes", async (request, reply) => {
    try {
      const authorized = await requireAdmin(request, reply, jwtSecret);
      if (!authorized) {
        return;
      }

      const route = await shuttleService.createRoute(request.body as never);
      reply.code(201);
      return { route };
    } catch (error) {
      return handleAdminError(reply, error);
    }
  });

  app.patch("/admin/shuttle/routes/:id", async (request, reply) => {
    try {
      const authorized = await requireAdmin(request, reply, jwtSecret);
      if (!authorized) {
        return;
      }

      const { id } = request.params as { id: string };
      const route = await shuttleService.updateRoute(id, request.body as never);
      return { route };
    } catch (error) {
      return handleAdminError(reply, error);
    }
  });

  app.get("/admin/shuttle/schedules", async (request, reply) => {
    try {
      const authorized = await requireAdmin(request, reply, jwtSecret);
      if (!authorized) {
        return;
      }

      const query = request.query as { routeId?: string };
      const schedules = await shuttleService.listSchedules(query.routeId);
      return { schedules };
    } catch (error) {
      return handleAdminError(reply, error);
    }
  });

  app.post("/admin/shuttle/schedules", async (request, reply) => {
    try {
      const authorized = await requireAdmin(request, reply, jwtSecret);
      if (!authorized) {
        return;
      }

      const schedule = await shuttleService.createSchedule(request.body as never);
      reply.code(201);
      return { schedule };
    } catch (error) {
      return handleAdminError(reply, error);
    }
  });

  app.patch("/admin/shuttle/schedules/:id", async (request, reply) => {
    try {
      const authorized = await requireAdmin(request, reply, jwtSecret);
      if (!authorized) {
        return;
      }

      const { id } = request.params as { id: string };
      const schedule = await shuttleService.updateSchedule(id, request.body as never);
      return { schedule };
    } catch (error) {
      return handleAdminError(reply, error);
    }
  });
}

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  jwtSecret: string
): Promise<boolean> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    reply.code(401);
    reply.send({ message: "Missing bearer token" });
    return false;
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const claims = await verifyAccessToken(token, jwtSecret);
    if (claims.role !== "admin") {
      reply.code(403);
      reply.send({ message: "Admin role required" });
      return false;
    }

    return true;
  } catch {
    reply.code(401);
    reply.send({ message: "Invalid access token" });
    return false;
  }
}

function handleAdminError(reply: FastifyReply, error: unknown) {
  if (error instanceof ShuttleServiceError) {
    reply.code(error.statusCode);
    return { message: error.message };
  }

  reply.code(500);
  return { message: "Internal server error" };
}
