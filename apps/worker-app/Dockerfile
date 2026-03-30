FROM node:24-alpine AS base
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json pnpm-lock.yaml ./
COPY apps/worker-app/package.json apps/worker-app/package.json

RUN pnpm install --frozen-lockfile

COPY apps/worker-app apps/worker-app

RUN pnpm --filter @iwootcall/worker-app build

WORKDIR /workspace/apps/worker-app
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["pnpm", "start"]
