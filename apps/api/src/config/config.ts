/**
 * IwootCall ??Zero-commission open source dispatch platform
 * Modules: FreeCab, FreeDrive, FreeCargo, FreeRun, FreeShuttle
 * Copyright (c) 2025 22B Labs
 * Licensed under MIT License
 */

import { ModuleType } from "@iwootcall/shared";

const VALID_MODULES = new Set(Object.values(ModuleType));

export type MapProvider = "osm" | "kakao" | "naver" | "tmap";
export type NotificationPushProvider = "console" | "firebase-admin";
export type NotificationSmsProvider = "console" | "webhook";

export interface NotificationConfig {
  pushProvider: NotificationPushProvider;
  firebaseCredentialsPath?: string;
  smsProvider: NotificationSmsProvider;
  smsWebhookUrl?: string;
  smsWebhookAuthToken?: string;
}

export interface AppConfig {
  port: number;
  host: string;
  jwtSecret: string;
  databaseUrl: string;
  redisUrl: string;
  corsOrigins?: string[];
  enabledModules: ModuleType[];
  mapProvider: MapProvider;
  osrmUrl: string;
  tileServerUrl: string;
  notification?: NotificationConfig;
}

type EnvSource = Record<string, string | undefined>;

function requireEnv(env: EnvSource, key: string, fallback?: string): string {
  const value = env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function parseEnabledModules(value: string): ModuleType[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (!VALID_MODULES.has(entry as ModuleType)) {
        throw new Error(`Unsupported module in ENABLED_MODULES: ${entry}`);
      }

      return entry as ModuleType;
    });
}

function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadConfig(env: EnvSource = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? "3001"),
    host: env.HOST ?? "0.0.0.0",
    jwtSecret: requireEnv(env, "JWT_SECRET"),
    databaseUrl: requireEnv(
      env,
      "DATABASE_URL",
      "postgresql://iwootcall:iwootcall@localhost:5432/iwootcall"
    ),
    redisUrl: requireEnv(env, "REDIS_URL", "redis://localhost:6379"),
    corsOrigins: parseCorsOrigins(
      env.CORS_ORIGINS ??
        "http://localhost:3101,http://localhost:3102,http://localhost:3103"
    ),
    enabledModules: parseEnabledModules(
      env.ENABLED_MODULES ?? "FREECAB,FREEDRIVE,FREECARGO,FREERUN"
    ),
    mapProvider: (env.MAP_PROVIDER ?? "osm") as MapProvider,
    osrmUrl: requireEnv(env, "OSRM_URL", "http://localhost:5000"),
    tileServerUrl: requireEnv(
      env,
      "TILESERVER_URL",
      "http://localhost:8080"
    ),
    notification: {
      pushProvider: (env.PUSH_PROVIDER ?? "console") as NotificationPushProvider,
      firebaseCredentialsPath:
        env.FIREBASE_CREDENTIALS_PATH ?? env.GOOGLE_APPLICATION_CREDENTIALS,
      smsProvider: (env.SMS_PROVIDER ?? "console") as NotificationSmsProvider,
      smsWebhookUrl: env.SMS_WEBHOOK_URL,
      smsWebhookAuthToken: env.SMS_WEBHOOK_AUTH_TOKEN
    }
  };
}
