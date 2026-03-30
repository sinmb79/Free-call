/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { AuthError, AuthService } from "../core/auth/auth.service.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
  authService: AuthService
): Promise<void> {
  app.post("/auth/worker/register", async (request, reply) => {
    try {
      const worker = await authService.registerWorker(request.body as never);
      reply.code(201);
      return { worker };
    } catch (error) {
      return handleAuthError(reply, error);
    }
  });

  app.post("/auth/worker/login", async (request, reply) => {
    try {
      return await authService.loginWorker(request.body as never);
    } catch (error) {
      return handleAuthError(reply, error);
    }
  });

  app.post("/auth/customer/register", async (request, reply) => {
    try {
      const customer = await authService.registerCustomer(request.body as never);
      reply.code(201);
      return { customer };
    } catch (error) {
      return handleAuthError(reply, error);
    }
  });

  app.post("/auth/customer/login", async (request, reply) => {
    try {
      return await authService.loginCustomer(request.body as never);
    } catch (error) {
      return handleAuthError(reply, error);
    }
  });
}

function handleAuthError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuthError) {
    reply.code(error.statusCode);
    return { message: error.message };
  }

  reply.code(500);
  return { message: "Internal server error" };
}
