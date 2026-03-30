import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  ServerSocketEvents,
  SocketRooms,
  WorkerSocketEvents
} from "@iwootcall/shared";
import type { AccessTokenClaims, WorkerRecord } from "../core/auth/types.js";
import type { DispatchEventSink } from "../core/dispatch/dispatch.engine.js";
import type { JobRecord } from "../core/jobs/types.js";
import { verifyAccessToken } from "../lib/token.js";
import type { WorkerJobService } from "./worker-job.service.js";

interface SocketData {
  claims: AccessTokenClaims;
}

export class SocketGateway implements DispatchEventSink {
  private readonly io: Server<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

  constructor(
    server: HttpServer,
    private readonly jwtSecret: string,
    private readonly workerJobService: WorkerJobService
  ) {
    this.io = new Server(server, {
      cors: {
        origin: true,
        credentials: true
      }
    });
    this.io.use(async (socket, next) => {
      try {
        const claims = await this.authenticate(socket);
        socket.data.claims = claims;
        next();
      } catch {
        next(new Error("Invalid access token"));
      }
    });
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  async emitIncomingCall(workerId: string, job: JobRecord): Promise<void> {
    this.io.to(SocketRooms.worker(workerId)).emit(
      ServerSocketEvents.CALL_INCOMING,
      {
        jobId: job.id,
        workerId,
        customerId: job.customerId,
        module: job.module,
        originLat: job.originLat,
        originLng: job.originLng,
        originAddress: job.originAddress,
        destLat: job.destLat,
        destLng: job.destLng,
        destAddress: job.destAddress,
        estimatedFare: job.estimatedFare,
        metadata: job.metadata
      }
    );
  }

  async emitDispatchFailed(job: JobRecord): Promise<void> {
    const payload = {
      jobId: job.id,
      customerId: job.customerId,
      status: job.status
    };

    this.io.to(SocketRooms.customer(job.customerId)).emit(
      ServerSocketEvents.DISPATCH_FAILED,
      payload
    );
    this.io.to(SocketRooms.job(job.id)).emit(
      ServerSocketEvents.DISPATCH_FAILED,
      payload
    );
    this.io.to(SocketRooms.adminLive).emit(
      ServerSocketEvents.DISPATCH_FAILED,
      payload
    );
  }

  async emitWorkerAssigned(job: JobRecord, worker: WorkerRecord): Promise<void> {
    const jobRoom = SocketRooms.job(job.id);
    this.io.in(SocketRooms.worker(worker.id)).socketsJoin(jobRoom);
    this.io.in(SocketRooms.customer(job.customerId)).socketsJoin(jobRoom);

    this.io.to(SocketRooms.customer(job.customerId)).emit(
      ServerSocketEvents.WORKER_ASSIGNED,
      {
        jobId: job.id,
        customerId: job.customerId,
        workerId: worker.id,
        status: job.status,
        acceptedAt: job.acceptedAt
      }
    );
  }

  async emitWorkerLocation(job: JobRecord, worker: WorkerRecord): Promise<void> {
    const payload = {
      jobId: job.id,
      customerId: job.customerId,
      workerId: worker.id,
      lat: worker.lat,
      lng: worker.lng,
      lastSeenAt: worker.lastSeenAt
    };

    this.io.to(SocketRooms.customer(job.customerId)).emit(
      ServerSocketEvents.WORKER_LOCATION,
      payload
    );
    this.io.to(SocketRooms.job(job.id)).emit(
      ServerSocketEvents.WORKER_LOCATION,
      payload
    );
    this.io.to(SocketRooms.adminLive).emit(
      ServerSocketEvents.WORKER_LOCATION,
      payload
    );
  }

  async emitWorkerArrived(job: JobRecord, worker: WorkerRecord): Promise<void> {
    this.emitToJobAudiences(ServerSocketEvents.WORKER_ARRIVED, job, worker);
  }

  async emitJobStarted(job: JobRecord, worker: WorkerRecord): Promise<void> {
    this.emitToJobAudiences(ServerSocketEvents.JOB_STARTED, job, worker);
  }

  async emitJobCompleted(job: JobRecord, worker: WorkerRecord): Promise<void> {
    this.emitToJobAudiences(ServerSocketEvents.JOB_COMPLETED, job, worker);
  }

  async close(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.io.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ERR_SERVER_NOT_RUNNING") {
        throw error;
      }
    }
  }

  private handleConnection(
    socket: Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>
  ): void {
    const claims = socket.data.claims;
    if (claims.role === "worker") {
      socket.join(SocketRooms.worker(claims.sub));
      this.registerWorkerHandlers(socket, claims.sub);
      return;
    }

    if (claims.role === "customer") {
      socket.join(SocketRooms.customer(claims.sub));
      return;
    }

    if (claims.role === "admin") {
      socket.join(SocketRooms.adminLive);
    }
  }

  private registerWorkerHandlers(
    socket: Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>,
    workerId: string
  ): void {
    socket.on(WorkerSocketEvents.LOCATION_UPDATE, async (payload: Record<string, unknown>) => {
      await this.workerJobService.handleLocationUpdate(
        workerId,
        Number(payload.lat),
        Number(payload.lng)
      );
    });
    socket.on(WorkerSocketEvents.CALL_ACCEPT, async (payload: Record<string, unknown>) => {
      await this.workerJobService.handleCallAccept(workerId, String(payload.jobId));
    });
    socket.on(WorkerSocketEvents.CALL_REJECT, async (payload: Record<string, unknown>) => {
      await this.workerJobService.handleCallReject(workerId, String(payload.jobId));
    });
    socket.on(WorkerSocketEvents.ARRIVED, async (payload: Record<string, unknown>) => {
      await this.workerJobService.handleArrived(workerId, String(payload.jobId));
    });
    socket.on(WorkerSocketEvents.JOB_START, async (payload: Record<string, unknown>) => {
      await this.workerJobService.handleJobStart(workerId, String(payload.jobId));
    });
    socket.on(WorkerSocketEvents.JOB_COMPLETE, async (payload: Record<string, unknown>) => {
      await this.workerJobService.handleJobComplete(workerId, String(payload.jobId));
    });
  }

  private async authenticate(
    socket: Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>
  ): Promise<AccessTokenClaims> {
    const authToken = socket.handshake.auth.token;
    const queryToken = socket.handshake.query.token;
    const headerValue = socket.handshake.headers.authorization;
    const headerToken =
      typeof headerValue === "string" && headerValue.startsWith("Bearer ")
        ? headerValue.slice("Bearer ".length)
        : undefined;
    const token =
      typeof authToken === "string"
        ? authToken
        : typeof queryToken === "string"
          ? queryToken
          : headerToken;
    if (!token) {
      throw new Error("Missing access token");
    }

    return verifyAccessToken(token, this.jwtSecret);
  }

  private emitToJobAudiences(
    eventName: string,
    job: JobRecord,
    worker: WorkerRecord
  ): void {
    const payload = {
      jobId: job.id,
      customerId: job.customerId,
      workerId: worker.id,
      status: job.status
    };

    this.io.to(SocketRooms.customer(job.customerId)).emit(eventName, payload);
    this.io.to(SocketRooms.job(job.id)).emit(eventName, payload);
    this.io.to(SocketRooms.adminLive).emit(eventName, payload);
  }
}
