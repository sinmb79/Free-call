import { describe, expect, it, vi } from "vitest";
import { ModuleType } from "@iwootcall/shared";
import { loadConfig } from "../../config/config.js";
import {
  createNotificationProviders,
  FirebaseAdminPushNotificationProvider,
  WebhookSmsNotificationProvider
} from "./notification.factory.js";

describe("notification factory", () => {
  it("uses console providers by default", () => {
    const config = loadConfig({
      JWT_SECRET: "super-secret-key",
      ENABLED_MODULES: ModuleType.FREECAB
    });

    const providers = createNotificationProviders(config);

    expect(providers.pushProvider.constructor.name).toBe(
      "ConsolePushNotificationProvider"
    );
    expect(providers.smsProvider.constructor.name).toBe(
      "ConsoleSmsNotificationProvider"
    );
  });

  it("falls back to console providers when legacy app config omits notification", () => {
    const providers = createNotificationProviders({
      port: 3001,
      host: "0.0.0.0",
      jwtSecret: "super-secret-key",
      databaseUrl: "postgresql://iwootcall:iwootcall@localhost:5432/iwootcall",
      redisUrl: "redis://localhost:6379",
      enabledModules: [ModuleType.FREECAB],
      mapProvider: "osm",
      osrmUrl: "http://localhost:5000",
      tileServerUrl: "http://localhost:8080"
    });

    expect(providers.pushProvider.constructor.name).toBe(
      "ConsolePushNotificationProvider"
    );
    expect(providers.smsProvider.constructor.name).toBe(
      "ConsoleSmsNotificationProvider"
    );
  });

  it("builds firebase and webhook providers when configured", () => {
    const config = loadConfig({
      JWT_SECRET: "super-secret-key",
      PUSH_PROVIDER: "firebase-admin",
      FIREBASE_CREDENTIALS_PATH: "C:\\firebase\\service-account.json",
      SMS_PROVIDER: "webhook",
      SMS_WEBHOOK_URL: "https://sms.example.com/send"
    });

    const providers = createNotificationProviders(config);

    expect(providers.pushProvider).toBeInstanceOf(
      FirebaseAdminPushNotificationProvider
    );
    expect(providers.smsProvider).toBeInstanceOf(WebhookSmsNotificationProvider);
  });

  it("sends SMS through the configured webhook", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200
    }));
    const provider = new WebhookSmsNotificationProvider(
      "https://sms.example.com/send",
      "secret-token",
      fetchMock as unknown as typeof fetch
    );

    await provider.send({
      phone: "01012345678",
      body: "hello"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sms.example.com/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          authorization: "Bearer secret-token"
        }),
        body: JSON.stringify({
          phone: "01012345678",
          body: "hello"
        })
      })
    );
  });
});
