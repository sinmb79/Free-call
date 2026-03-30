import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { JobQueryError, JobQueryService } from "../core/jobs/job-query.service.js";
import {
  WorkerModuleProfileError,
  WorkerModuleProfileService
} from "../core/modules/profile.service.js";
import { WorkerService, WorkerServiceError } from "../core/worker/worker.service.js";
import { verifyAccessToken } from "../lib/token.js";

export async function registerWorkerRoutes(
  app: FastifyInstance,
  workerService: WorkerService,
  workerModuleProfileService: WorkerModuleProfileService,
  jobQueryService: JobQueryService,
  jwtSecret: string
): Promise<void> {
  app.get("/worker/me", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const worker = await workerService.getWorker(claims.sub);
      return { worker };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });

  app.patch("/worker/presence", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const payload = request.body as {
        isOnline: boolean;
        lat?: number | null;
        lng?: number | null;
      };
      const worker = await workerService.updatePresence(claims.sub, payload);
      return { worker };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });

  app.patch("/worker/device", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const worker = await workerService.updateDeviceToken(
        claims.sub,
        request.body as never
      );
      return { worker };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });

  app.get("/worker/drive-profile", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const profile = await workerModuleProfileService.getDriveProfile(claims.sub);
      return {
        profile: {
          maxReturnWalkMeters: profile.maxReturnWalkMeters
        }
      };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });

  app.patch("/worker/drive-profile", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const profile = await workerModuleProfileService.updateDriveProfile(
        claims.sub,
        request.body as never
      );
      return {
        profile: {
          maxReturnWalkMeters: profile.maxReturnWalkMeters
        }
      };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });

  app.get("/worker/cargo-profile", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const profile = await workerModuleProfileService.getCargoProfile(claims.sub);
      return {
        profile: {
          canLoadingHelp: profile.canLoadingHelp,
          hasForklift: profile.hasForklift,
          businessRegNo: profile.businessRegNo
        }
      };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });

  app.patch("/worker/cargo-profile", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const profile = await workerModuleProfileService.updateCargoProfile(
        claims.sub,
        request.body as never
      );
      return {
        profile: {
          canLoadingHelp: profile.canLoadingHelp,
          hasForklift: profile.hasForklift,
          businessRegNo: profile.businessRegNo
        }
      };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });

  app.get("/worker/jobs/active", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const job = await jobQueryService.getActiveWorkerJob(claims.sub);
      return { job };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });

  app.get("/worker/earnings/today", async (request, reply) => {
    try {
      const claims = await requireWorker(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const summary = await jobQueryService.getWorkerEarningsToday(claims.sub);
      return { summary };
    } catch (error) {
      return handleWorkerError(reply, error);
    }
  });
}

async function requireWorker(
  request: FastifyRequest,
  reply: FastifyReply,
  jwtSecret: string
) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    reply.code(401);
    reply.send({ message: "Missing bearer token" });
    return null;
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const claims = await verifyAccessToken(token, jwtSecret);
    if (claims.role !== "worker") {
      reply.code(403);
      reply.send({ message: "Worker role required" });
      return null;
    }

    return claims;
  } catch {
    reply.code(401);
    reply.send({ message: "Invalid access token" });
    return null;
  }
}

function handleWorkerError(reply: FastifyReply, error: unknown) {
  if (
    error instanceof WorkerServiceError ||
    error instanceof WorkerModuleProfileError ||
    error instanceof JobQueryError
  ) {
    reply.code(error.statusCode);
    return { message: error.message };
  }

  reply.code(500);
  return { message: "Internal server error" };
}
