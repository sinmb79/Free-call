import type { CustomerStore, WorkerStore } from "../auth/store.js";
import type { DispatchEventSink } from "../dispatch/dispatch.engine.js";
import type { JobRecord } from "../jobs/types.js";
import {
  NotificationDeliveryService,
  NotificationKind
} from "./notification.service.js";

export class NotificationDispatchEventSink implements DispatchEventSink {
  constructor(
    private readonly workerStore: Pick<WorkerStore, "findById">,
    private readonly customerStore: Pick<CustomerStore, "findById">,
    private readonly notificationService: NotificationDeliveryService
  ) {}

  async emitIncomingCall(workerId: string, job: JobRecord): Promise<void> {
    const worker = await this.workerStore.findById(workerId);
    if (!worker) {
      return;
    }

    await this.notificationService.deliverToWorker(worker, {
      kind: NotificationKind.INCOMING_CALL,
      title: "Incoming call",
      body: `${job.module} request is waiting for response.`,
      data: {
        jobId: job.id,
        module: job.module
      }
    });
  }

  async emitDispatchFailed(job: JobRecord): Promise<void> {
    const customer = await this.customerStore.findById(job.customerId);
    if (!customer) {
      return;
    }

    await this.notificationService.deliverToCustomer(customer, {
      kind: NotificationKind.DISPATCH_FAILED,
      title: "Dispatch failed",
      body: "No nearby worker accepted the request.",
      data: {
        jobId: job.id
      }
    });
  }

  async emitWorkerAssigned(job: JobRecord): Promise<void> {
    const customer = await this.customerStore.findById(job.customerId);
    if (!customer) {
      return;
    }

    await this.notificationService.deliverToCustomer(customer, {
      kind: NotificationKind.WORKER_ASSIGNED,
      title: "Worker assigned",
      body: "A worker accepted the request.",
      data: {
        jobId: job.id
      }
    });
  }

  async emitWorkerLocation(): Promise<void> {
    // Live location remains socket-first to avoid notification spam.
  }

  async emitWorkerArrived(job: JobRecord): Promise<void> {
    const customer = await this.customerStore.findById(job.customerId);
    if (!customer) {
      return;
    }

    await this.notificationService.deliverToCustomer(customer, {
      kind: NotificationKind.WORKER_ARRIVED,
      title: "Worker arrived",
      body: "The worker has arrived at the pickup point.",
      data: {
        jobId: job.id
      }
    });
  }

  async emitJobStarted(job: JobRecord): Promise<void> {
    const customer = await this.customerStore.findById(job.customerId);
    if (!customer) {
      return;
    }

    await this.notificationService.deliverToCustomer(customer, {
      kind: NotificationKind.JOB_STARTED,
      title: "Job started",
      body: "The trip or task is now in progress.",
      data: {
        jobId: job.id
      }
    });
  }

  async emitJobCompleted(job: JobRecord): Promise<void> {
    const customer = await this.customerStore.findById(job.customerId);
    if (!customer) {
      return;
    }

    await this.notificationService.deliverToCustomer(customer, {
      kind: NotificationKind.JOB_COMPLETED,
      title: "Job completed",
      body: "The trip or task has been completed.",
      data: {
        jobId: job.id
      }
    });
  }
}
