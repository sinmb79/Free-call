import { readFile } from "node:fs/promises";
import type { AppConfig } from "../../config/config.js";
import type {
  PushNotificationProvider,
  SmsNotificationProvider
} from "./notification.service.js";
import {
  ConsolePushNotificationProvider,
  ConsoleSmsNotificationProvider
} from "./notification.service.js";

export class WebhookSmsNotificationProvider implements SmsNotificationProvider {
  constructor(
    private readonly webhookUrl: string,
    private readonly authToken?: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async send(message: { phone: string; body: string }): Promise<void> {
    const response = await this.fetchImpl(this.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.authToken
          ? { authorization: `Bearer ${this.authToken}` }
          : {})
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`SMS webhook failed with status ${response.status}`);
    }
  }
}

export class FirebaseAdminPushNotificationProvider
  implements PushNotificationProvider
{
  private messagingPromise:
    | Promise<{ send(message: unknown): Promise<string> }>
    | null = null;

  constructor(private readonly credentialsPath: string) {}

  async send(message: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
  }): Promise<void> {
    const messaging = await this.getMessaging();
    await messaging.send({
      token: message.token,
      notification: {
        title: message.title,
        body: message.body
      },
      data: message.data
    });
  }

  private async getMessaging(): Promise<{
    send(message: unknown): Promise<string>;
  }> {
    if (!this.messagingPromise) {
      this.messagingPromise = this.initializeMessaging();
    }

    return this.messagingPromise;
  }

  private async initializeMessaging(): Promise<{
    send(message: unknown): Promise<string>;
  }> {
    const serviceAccount = JSON.parse(
      await readFile(this.credentialsPath, "utf8")
    ) as Record<string, unknown>;

    const adminApp = await import("firebase-admin/app");
    const adminMessaging = await import("firebase-admin/messaging");
    const appName = "iwootcall-notifications";
    const existingApp =
      adminApp.getApps().find((app) => app.name === appName) ?? null;
    const app =
      existingApp ??
      adminApp.initializeApp(
        {
          credential: adminApp.cert(serviceAccount)
        },
        appName
      );

    return adminMessaging.getMessaging(app);
  }
}

export function createNotificationProviders(config: AppConfig): {
  pushProvider: PushNotificationProvider;
  smsProvider: SmsNotificationProvider;
} {
  const notification = config.notification ?? {
    pushProvider: "console",
    smsProvider: "console"
  };

  const pushProvider =
    notification.pushProvider === "firebase-admin"
      ? new FirebaseAdminPushNotificationProvider(
          requireNotificationSetting(
            notification.firebaseCredentialsPath,
            "FIREBASE_CREDENTIALS_PATH"
          )
        )
      : new ConsolePushNotificationProvider();

  const smsProvider =
    notification.smsProvider === "webhook"
      ? new WebhookSmsNotificationProvider(
          requireNotificationSetting(
            notification.smsWebhookUrl,
            "SMS_WEBHOOK_URL"
          ),
          notification.smsWebhookAuthToken
        )
      : new ConsoleSmsNotificationProvider();

  return {
    pushProvider,
    smsProvider
  };
}

function requireNotificationSetting(
  value: string | undefined,
  envKey: string
): string {
  if (!value) {
    throw new Error(`Missing required notification setting: ${envKey}`);
  }

  return value;
}
