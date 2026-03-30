FROM node:24-alpine AS base
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json pnpm-lock.yaml ./
COPY apps/customer-app/package.json apps/customer-app/package.json

RUN pnpm install --frozen-lockfile

COPY apps/customer-app apps/customer-app

RUN pnpm --filter @iwootcall/customer-app build

WORKDIR /workspace/apps/customer-app
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["pnpm", "start"]
