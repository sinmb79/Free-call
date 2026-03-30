import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { DispatchEngine } from "../dispatch/dispatch.engine.js";

const DISPATCH_QUEUE_NAME = "iwootcall-dispatch";
const DISPATCH_JOB_NAME = "dispatch";
const WORKER_TIMEOUT_JOB_NAME = "worker-timeout";

export interface DispatchQueue {
  enqueue(jobId: string): Promise<void>;
  scheduleWorkerTimeout(jobId: string, workerId: string): Promise<void>;
}

export class InlineDispatchQueue implements DispatchQueue {
  constructor(
    private readonly processor: (jobId: string) => Promise<void>,
    private readonly timeoutProcessor?: (
      jobId: string,
      workerId: string
    ) => Promise<void>
  ) {}

  async enqueue(jobId: string): Promise<void> {
    await this.processor(jobId);
  }

  async scheduleWorkerTimeout(jobId: string, workerId: string): Promise<void> {
    await this.timeoutProcessor?.(jobId, workerId);
  }
}

export class DispatchOrchestrator {
  constructor(
    private readonly dispatchEngine: DispatchEngine,
    private readonly dispatchQueue: Pick<DispatchQueue, "scheduleWorkerTimeout">
  ) {}

  async processDispatch(jobId: string): Promise<void> {
    const workerId = await this.dispatchEngine.dispatchJob(jobId);
    if (workerId) {
      await this.dispatchQueue.scheduleWorkerTimeout(jobId, workerId);
    }
  }

  async processWorkerTimeout(jobId: string, workerId: string): Promise<void> {
    const nextWorkerId = await this.dispatchEngine.onWorkerTimeout(jobId, workerId);
    if (nextWorkerId) {
      await this.dispatchQueue.scheduleWorkerTimeout(jobId, nextWorkerId);
    }
  }
}

interface DispatchQueuePayload {
  jobId: string;
  workerId?: string;
}

export class BullMqDispatchQueue implements DispatchQueue {
  constructor(
    private readonly queue: Queue<DispatchQueuePayload>,
    private readonly workerResponseTimeoutMs = 15000
  ) {}

  async enqueue(jobId: string): Promise<void> {
    await this.queue.add(
      DISPATCH_JOB_NAME,
      { jobId },
      {
        removeOnComplete: true,
        removeOnFail: 100
      }
    );
  }

  async scheduleWorkerTimeout(jobId: string, workerId: string): Promise<void> {
    await this.queue.add(
      WORKER_TIMEOUT_JOB_NAME,
      { jobId, workerId },
      {
        delay: this.workerResponseTimeoutMs,
        jobId: `${WORKER_TIMEOUT_JOB_NAME}:${jobId}:${workerId}`,
        removeOnComplete: true,
        removeOnFail: 100
      }
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

export interface BullMqDispatchRuntime {
  dispatchQueue: DispatchQueue;
  close(): Promise<void>;
}

export function createBullMqDispatchRuntime(
  redisUrl: string,
  resolveOrchestrator: () => DispatchOrchestrator | null,
  workerResponseTimeoutMs = 15000
): BullMqDispatchRuntime {
  const queueConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null
  });
  const workerConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null
  });
  const queue = new Queue<DispatchQueuePayload>(DISPATCH_QUEUE_NAME, {
    connection: queueConnection
  });
  const worker = new Worker<DispatchQueuePayload>(
    DISPATCH_QUEUE_NAME,
    async (job) => {
      const orchestrator = resolveOrchestrator();
      if (!orchestrator) {
        throw new Error("Dispatch orchestrator is not ready");
      }

      await processBullMqJob(job, orchestrator);
    },
    {
      connection: workerConnection
    }
  );
  const dispatchQueue = new BullMqDispatchQueue(queue, workerResponseTimeoutMs);

  return {
    dispatchQueue,
    async close(): Promise<void> {
      await worker.close();
      await dispatchQueue.close();
      await Promise.allSettled([queueConnection.quit(), workerConnection.quit()]);
    }
  };
}

async function processBullMqJob(
  job: Job<DispatchQueuePayload>,
  orchestrator: DispatchOrchestrator
): Promise<void> {
  if (job.name === DISPATCH_JOB_NAME) {
    await orchestrator.processDispatch(job.data.jobId);
    return;
  }

  if (job.name === WORKER_TIMEOUT_JOB_NAME && job.data.workerId) {
    await orchestrator.processWorkerTimeout(job.data.jobId, job.data.workerId);
    return;
  }

  throw new Error(`Unsupported dispatch queue job: ${job.name}`);
}
