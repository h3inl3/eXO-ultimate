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

Everything runs in one AWS project in **us-east-2** (CLI profile `exo-ultimate`).

| App | Where | How |
|-----|-------|-----|
| API + DB | Lambda Web Function + private RDS Postgres 17, stack `exo` from [infra/aws.yaml](infra/aws.yaml) | `apps/api/scripts/package-lambda.sh`, upload `apps/api/dist/function.zip` to the stack's `CodeBucket`, then update the stack with `ApiCodeKey` / `ApiCodeVersion` (the new S3 version id). Migrations run on startup under an advisory lock. The DB password lives in the RDS-managed secret |
| Web | Amplify Hosting, built from [amplify.yml](amplify.yml) | Connected to GitHub in the Amplify console with app root `apps/web`; set `NEXT_PUBLIC_API_URL` |
| Mobile | EAS | `cd apps/mobile && eas init && eas build --profile preview` |

The API Dockerfile still works for running the API in a container locally.

## Try the scoring prototype

Run `pnpm --filter @exo/mobile dev` and open the app in Expo Go or a simulator. Tap **Try the scoring prototype**.

It runs entirely on-device and uses the same state machine the API uses to validate uploaded games.
