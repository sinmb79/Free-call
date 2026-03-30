import { describe, expect, it } from "vitest";
import { ModuleType, VehicleType } from "@iwootcall/shared";
import type { CustomerRecord, WorkerRecord } from "../auth/types.js";
import {
  NotificationKind,
  type PushNotificationProvider,
  type SmsNotificationProvider
} from "./notification.service.js";
import { NotificationDeliveryService } from "./notification.service.js";

describe("NotificationDeliveryService", () => {
  it("prefers push delivery when a device token is available", async () => {
    const pushMessages: Array<{ token: string; title: string }> = [];
    const smsMessages: string[] = [];
    const service = new NotificationDeliveryService(
      {
        async send(message) {
          pushMessages.push({
            token: message.token,
            title: message.title
          });
        }
      } satisfies PushNotificationProvider,
      {
        async send(message) {
          smsMessages.push(message.phone);
        }
      } satisfies SmsNotificationProvider
    );

    await service.deliverToWorker(buildWorker({ fcmToken: "token-1" }), {
      kind: NotificationKind.INCOMING_CALL,
      title: "Incoming call",
      body: "New FreeCab booking",
      data: {
        jobId: "job-1"
      }
    });

    expect(pushMessages).toEqual([
      {
        token: "token-1",
        title: "Incoming call"
      }
    ]);
    expect(smsMessages).toEqual([]);
  });

  it("falls back to SMS when push delivery fails or no device token exists", async () => {
    const smsMessages: Array<{ phone: string; body: string }> = [];
    const service = new NotificationDeliveryService(
      {
        async send() {
          throw new Error("Push delivery failed");
        }
      } satisfies PushNotificationProvider,
      {
        async send(message) {
          smsMessages.push({
            phone: message.phone,
            body: message.body
          });
        }
      } satisfies SmsNotificationProvider
    );

    await service.deliverToCustomer(buildCustomer({ fcmToken: "token-2" }), {
      kind: NotificationKind.DISPATCH_FAILED,
      title: "Dispatch failed",
      body: "No nearby worker accepted the request.",
      data: {
        jobId: "job-2"
      }
    });
    await service.deliverToWorker(buildWorker({ fcmToken: null }), {
      kind: NotificationKind.JOB_COMPLETED,
      title: "Completed",
      body: "Job finished",
      data: {
        jobId: "job-3"
      }
    });

    expect(smsMessages).toEqual([
      {
        phone: "01090000002",
        body: "Dispatch failed: No nearby worker accepted the request."
      },
      {
        phone: "01090000001",
        body: "Completed: Job finished"
      }
    ]);
  });
});

function buildWorker(
  overrides: Partial<WorkerRecord>
): WorkerRecord {
  return {
    id: "worker-1",
    phone: "01090000001",
    name: "Worker One",
    fcmToken: "worker-token",
    module: ModuleType.FREECAB,
    vehicleType: VehicleType.SEDAN,
    vehicleNumber: "90A1001",
    status: "ACTIVE",
    isOnline: true,
    lat: 37.5,
    lng: 127,
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

function buildCustomer(
  overrides: Partial<CustomerRecord>
): CustomerRecord {
  return {
    id: "customer-1",
    phone: "01090000002",
    name: "Customer One",
    fcmToken: "customer-token",
    elderlyMode: false,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}
