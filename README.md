# IwootCall

Zero-commission open source dispatch platform foundation for IwootCall.

## Korean Guides

- [Beginner setup guide in Korean](./docs/guides/BEGINNER_GUIDE_KO.md)
- [GitHub publishing guide in Korean](./docs/guides/GITHUB_PUBLISHING_KO.md)

## Current Scope

This repository currently implements the foundation plus the main Day 2 to Day 4 backend core, along with the next worker and job query API slice:

- `pnpm` monorepo with Turborepo
- shared module configuration package
- Fastify API bootstrap with `/health`
- worker and customer auth routes with development OTP flow
- admin worker listing and status update routes guarded by admin JWT
- customer vehicle CRUD and customer job read APIs
- customer profile, elderly mode, and favorite place APIs
- worker and customer device token registration APIs
- worker profile, presence, active job, and daily earnings APIs
- FreeDrive and FreeCargo worker profile APIs
- FreeRun multi-stop batch intake API with nearest-neighbor stop optimization
- FreeShuttle admin route and schedule management APIs
- FreeShuttle customer route listing and seat booking APIs
- admin job query API with status and module filters
- admin stats API for enabled modules
- dispatch engine with queue orchestration and realtime socket events
- notification delivery with push-first and SMS fallback development providers
- notification provider selection with Firebase Admin push and SMS webhook fallback
- baseline Prisma migration and development seed script
- Prisma unified schema foundation
- local Docker Compose definition for Postgres, Redis, OSRM, TileServer, and API
- Next.js customer, worker, and admin dashboards wired to the live API
- admin-panel local dev token helper route for beginner-friendly admin access

## Getting Started

1. Copy `.env.example` to `.env`
2. Install dependencies with `pnpm install`
3. Start PostgreSQL and Redis with `pnpm dev:stack`
4. Start the API and all frontend apps with `pnpm dev:start`
5. Run the local smoke flow with `pnpm smoke:local`
6. Stop the background processes with `pnpm dev:stop`
7. Run tests with `pnpm test`
8. Validate Prisma with `pnpm --filter @iwootcall/api prisma:validate`
9. Validate compose with `docker compose config`

## Workspace Commands

- `pnpm test`
- `pnpm build`
- `pnpm typecheck`
- `pnpm dev:stack`
- `pnpm dev:stack:down`
- `pnpm dev:start`
- `pnpm smoke:local`
- `pnpm dev:stop`
- `pnpm clean:local`
- `pnpm --filter @iwootcall/shared test`
- `pnpm --filter @iwootcall/api test`
- `pnpm --filter @iwootcall/api prisma:deploy`
- `pnpm --filter @iwootcall/api prisma:seed`
- `pnpm --filter @iwootcall/api prisma:validate`

## Local Run Notes

- `pnpm dev:start` now fails fast when PostgreSQL or Redis is missing and tells you to run `pnpm dev:stack` first.
- `pnpm smoke:local` performs the same dependency preflight before sending API requests.
- `pnpm clean:local` removes local-only outputs such as `output`, `.turbo`, app `.next`, and built `dist` folders before publishing.
- Runtime logs are written under `output/runtime`.
