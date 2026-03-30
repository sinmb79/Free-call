/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/config.js";

export async function registerHealthRoute(
  app: FastifyInstance,
  config: AppConfig
): Promise<void> {
  app.get("/health", async () => ({
    status: "ok",
    service: "iwootcall-api",
    enabledModules: config.enabledModules
  }));
}
