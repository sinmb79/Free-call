FROM node:24-alpine AS base
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json pnpm-lock.yaml ./
COPY apps/admin-panel/package.json apps/admin-panel/package.json

RUN pnpm install --frozen-lockfile

COPY apps/admin-panel apps/admin-panel

RUN pnpm --filter @iwootcall/admin-panel build

WORKDIR /workspace/apps/admin-panel
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["pnpm", "start"]
