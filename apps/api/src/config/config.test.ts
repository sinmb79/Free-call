import { describe, expect, it } from "vitest";
import { ModuleType } from "@iwootcall/shared";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("applies defaults and parses enabled modules", () => {
    const config = loadConfig({
      JWT_SECRET: "super-secret-key",
      ENABLED_MODULES: "FREECAB,FREERUN"
    });

    expect(config.port).toBe(3001);
    expect(config.corsOrigins).toEqual([
      "http://localhost:3101",
      "http://localhost:3102",
      "http://localhost:3103"
    ]);
    expect(config.enabledModules).toEqual([
      ModuleType.FREECAB,
      ModuleType.FREERUN
    ]);
  });

  it("throws when JWT_SECRET is missing", () => {
    expect(() => loadConfig({})).toThrow(/JWT_SECRET/);
  });

  it("parses notification provider settings", () => {
    const config = loadConfig({
      JWT_SECRET: "super-secret-key",
      PUSH_PROVIDER: "firebase-admin",
      FIREBASE_CREDENTIALS_PATH: "C:\\firebase\\service-account.json",
      SMS_PROVIDER: "webhook",
      SMS_WEBHOOK_URL: "https://sms.example.com/send",
      SMS_WEBHOOK_AUTH_TOKEN: "secret-token"
    });

    expect(config.notification).toEqual({
      pushProvider: "firebase-admin",
      firebaseCredentialsPath: "C:\\firebase\\service-account.json",
      smsProvider: "webhook",
      smsWebhookUrl: "https://sms.example.com/send",
      smsWebhookAuthToken: "secret-token"
    });
  });
});
