# eXO Ultimate

Manage ultimate frisbee teams on web, iOS and Android: rosters, seasons, live game stats and a playbook.
See [docs/PLAN.md](docs/PLAN.md) for the full implementation plan.

## Layout

| Path | What |
|------|------|
| `apps/api` | Fastify + Drizzle + PostgreSQL. The common backend (`/v1` REST) |
| `apps/web` | Next.js web app |
| `apps/mobile` | Expo / React Native app (iOS + Android). Includes the scoring prototype at `/score` |
| `packages/shared` | Domain types, Zod schemas, scoring state machine, stat engine, play-diagram model |
| `packages/api-client` | Typed API client generated from the API's OpenAPI spec |
| `infra` | docker-compose for local Postgres + Redis |

## Getting started

Requires Node 22+, pnpm (`corepack enable`), and Docker.

```bash
pnpm install
cd apps/mobile && pnpm fix-deps && cd ../..   # aligns Expo package versions with the installed SDK

pnpm db:up                                    # Postgres + Redis
cp apps/api/.env.example apps/api/.env
pnpm --filter @exo/api db:generate && pnpm --filter @exo/api db:migrate

pnpm test                                     # shared engine tests
pnpm dev                                      # api :4000, web :3000, Expo dev server
```

API docs are served at http://localhost:4000/docs. After changing a route, run `pnpm api:generate` to refresh `packages/api-client` (CI fails if it is stale, and likewise for migrations after a schema change).

Dev auth is a stub. Send `x-dev-user: <user uuid>` on API requests until OIDC lands in Phase 1.

## Deploy

| App | Where | How |
|-----|-------|-----|
| API | Any container host (Fly.io / Render / ECS) | `docker build -f apps/api/Dockerfile .`. Set `DATABASE_URL`; run `pnpm --filter @exo/api db:migrate` as the release command |
| Web | Vercel | Import the repo, set Root Directory to `apps/web`, set `NEXT_PUBLIC_API_URL` |
| Mobile | EAS | `cd apps/mobile && eas init && eas build --profile preview` |

## Try the scoring prototype

Run `pnpm --filter @exo/mobile dev` and open the app in Expo Go or a simulator. Tap **Try the scoring prototype**.

It runs entirely on-device and uses the same state machine the API uses to validate uploaded games.
