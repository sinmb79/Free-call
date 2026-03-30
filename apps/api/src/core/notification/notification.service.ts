import type { CustomerRecord, WorkerRecord } from "../auth/types.js";

export enum NotificationKind {
  INCOMING_CALL = "INCOMING_CALL",
  DISPATCH_FAILED = "DISPATCH_FAILED",
  WORKER_ASSIGNED = "WORKER_ASSIGNED",
  WORKER_ARRIVED = "WORKER_ARRIVED",
  JOB_STARTED = "JOB_STARTED",
  JOB_COMPLETED = "JOB_COMPLETED"
}

export interface NotificationPayload {
  kind: NotificationKind;
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushNotificationProvider {
  send(message: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
  }): Promise<void>;
}

export interface SmsNotificationProvider {
  send(message: {
    phone: string;
    body: string;
  }): Promise<void>;
}

export class NotificationDeliveryService {
  constructor(
    private readonly pushProvider: PushNotificationProvider,
    private readonly smsProvider: SmsNotificationProvider
  ) {}

  async deliverToWorker(
    worker: WorkerRecord,
    payload: NotificationPayload
  ): Promise<void> {
    await this.deliver(worker.phone, worker.fcmToken, payload);
  }

  async deliverToCustomer(
    customer: CustomerRecord,
    payload: NotificationPayload
  ): Promise<void> {
    await this.deliver(customer.phone, customer.fcmToken, payload);
  }

  private async deliver(
    phone: string,
    fcmToken: string | null,
    payload: NotificationPayload
  ): Promise<void> {
    if (fcmToken) {
      try {
        await this.pushProvider.send({
          token: fcmToken,
          title: payload.title,
          body: payload.body,
          data: payload.data
        });
        return;
      } catch {
        // Fall back to SMS when push delivery is unavailable.
      }
    }

    await this.smsProvider.send({
      phone,
      body: `${payload.title}: ${payload.body}`
    });
  }
}

export class ConsolePushNotificationProvider implements PushNotificationProvider {
  async send(message: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
  }): Promise<void> {
    console.info("push-notification", message);
  }
}

export class ConsoleSmsNotificationProvider implements SmsNotificationProvider {
  async send(message: {
    phone: string;
    body: string;
  }): Promise<void> {
    console.info("sms-notification", message);
  }
}
