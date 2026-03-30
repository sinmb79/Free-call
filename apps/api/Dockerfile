FROM node:24-alpine AS base
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --filter @iwootcall/shared build
RUN pnpm --filter @iwootcall/api build

WORKDIR /workspace/apps/api
CMD ["node", "dist/server.js"]
