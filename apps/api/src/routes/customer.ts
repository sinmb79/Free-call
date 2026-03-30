import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  CustomerProfileError,
  CustomerProfileService
} from "../core/auth/customer-profile.service.js";
import { CustomerVehicleError, CustomerVehicleService } from "../core/auth/customer-vehicle.service.js";
import { JobQueryError, JobQueryService } from "../core/jobs/job-query.service.js";
import { ShuttleService, ShuttleServiceError } from "../core/modules/shuttle.service.js";
import { verifyAccessToken } from "../lib/token.js";

export async function registerCustomerRoutes(
  app: FastifyInstance,
  customerProfileService: CustomerProfileService,
  customerVehicleService: CustomerVehicleService,
  shuttleService: ShuttleService,
  jobQueryService: JobQueryService,
  jwtSecret: string
): Promise<void> {
  app.get("/customer/me", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const customer = await customerProfileService.getProfile(claims.sub);
      return { customer };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.patch("/customer/me", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const customer = await customerProfileService.updateProfile(
        claims.sub,
        request.body as never
      );
      return { customer };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.patch("/customer/device", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const customer = await customerProfileService.updateDeviceToken(
        claims.sub,
        request.body as never
      );
      return { customer };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.get("/customer/shuttle/routes", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const routes = await shuttleService.listRoutes(true);
      return { routes };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.get("/customer/shuttle/schedules", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const query = request.query as { routeId?: string };
      const schedules = await shuttleService.listSchedules(query.routeId);
      return { schedules };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.post("/customer/shuttle/bookings", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const result = await shuttleService.bookSeat(claims.sub, request.body as never);
      reply.code(201);
      return result;
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.get("/customer/jobs", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const jobs = await jobQueryService.listCustomerJobs(claims.sub);
      return { jobs };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.get("/customer/jobs/:id", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const { id } = request.params as { id: string };
      const job = await jobQueryService.getCustomerJob(claims.sub, id);
      return { job };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.get("/customer/vehicles", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const vehicles = await customerVehicleService.list(claims.sub);
      return { vehicles };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.post("/customer/vehicles", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const vehicle = await customerVehicleService.create(
        claims.sub,
        request.body as never
      );
      reply.code(201);
      return { vehicle };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.patch("/customer/vehicles/:id", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const { id } = request.params as { id: string };
      const vehicle = await customerVehicleService.update(
        claims.sub,
        id,
        request.body as never
      );
      return { vehicle };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.delete("/customer/vehicles/:id", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const { id } = request.params as { id: string };
      await customerVehicleService.delete(claims.sub, id);
      reply.code(204);
      return null;
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.get("/customer/favorites", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const favorites = await customerProfileService.listFavorites(claims.sub);
      return { favorites };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.post("/customer/favorites", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const favorite = await customerProfileService.createFavorite(
        claims.sub,
        request.body as never
      );
      reply.code(201);
      return { favorite };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.patch("/customer/favorites/:id", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const { id } = request.params as { id: string };
      const favorite = await customerProfileService.updateFavorite(
        claims.sub,
        id,
        request.body as never
      );
      return { favorite };
    } catch (error) {
      return handleCustomerError(reply, error);
    }
  });

  app.delete("/customer/favorites/:id", async (request, reply) => {
    try {
      const claims = await requireCustomer(request, reply, jwtSecret);
      if (!claims) {
        return;
      }

      const { id } = request.params as { id: string };
      await customerProfileService.deleteFavorite(claims.sub, id);
      reply.code(204);
      return null;
    } catch (error) {
      return handleCustomerError(reply, error);
    }
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

function handleCustomerError(reply: FastifyReply, error: unknown) {
  if (
    error instanceof CustomerVehicleError ||
    error instanceof CustomerProfileError ||
    error instanceof ShuttleServiceError ||
    error instanceof JobQueryError
  ) {
    reply.code(error.statusCode);
    return { message: error.message };
  }

  reply.code(500);
  return { message: "Internal server error" };
}
