import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { JobService } from "../core/jobs/job.service.js";
import type { FreeRunService } from "../core/modules/freerun.service.js";
import { verifyAccessToken } from "../lib/token.js";

export async function registerJobRoutes(
  app: FastifyInstance,
  jobService: JobService,
  freeRunService: FreeRunService,
  jwtSecret: string
): Promise<void> {
  app.post("/jobs", async (request, reply) => {
    const claims = await requireCustomer(request, reply, jwtSecret);
    if (!claims) {
      return;
    }

    const payload = request.body as Record<string, unknown>;
    const job = await jobService.createJob({
      ...payload,
      customerId: claims.sub
    } as never);
    reply.code(201);
    return { job };
  });

  app.post("/freerun/batch", async (request, reply) => {
    const claims = await requireCustomer(request, reply, jwtSecret);
    if (!claims) {
      return;
    }

    const job = await freeRunService.createBatchJob(claims.sub, request.body as never);
    reply.code(201);
    return { job };
  });
}

async function requireCustomer(
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
    if (claims.role !== "customer") {
      reply.code(403);
      reply.send({ message: "Customer role required" });
      return null;
    }

    return claims;
  } catch {
    reply.code(401);
    reply.send({ message: "Invalid access token" });
    return null;
  }
}
