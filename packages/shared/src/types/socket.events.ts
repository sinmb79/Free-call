export const WorkerSocketEvents = {
  LOCATION_UPDATE: "worker:location:update",
  CALL_ACCEPT: "worker:call:accept",
  CALL_REJECT: "worker:call:reject",
  ARRIVED: "worker:arrived",
  JOB_START: "worker:job:start",
  JOB_COMPLETE: "worker:job:complete"
} as const;

export const ServerSocketEvents = {
  CALL_INCOMING: "call:incoming",
  CALL_CANCELLED: "call:cancelled",
  WORKER_ASSIGNED: "worker:assigned",
  WORKER_LOCATION: "worker:location",
  WORKER_ARRIVED: "worker:arrived",
  JOB_STARTED: "job:started",
  JOB_COMPLETED: "job:completed",
  DISPATCH_FAILED: "dispatch:failed"
} as const;

export const SocketRooms = {
  worker(workerId: string): string {
    return `worker:${workerId}`;
  },
  customer(customerId: string): string {
    return `customer:${customerId}`;
  },
  adminLive: "admin:live",
  job(jobId: string): string {
    return `job:${jobId}`;
  }
} as const;
