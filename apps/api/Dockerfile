# Build from the repo root: docker build -f apps/api/Dockerfile .
# Node strips TypeScript types natively, so the API runs from source with no build step.
FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY . .
# Dev deps stay in: drizzle-kit runs migrations as the release step (`pnpm --filter @exo/api db:migrate`).
RUN pnpm install --frozen-lockfile --filter @exo/api...
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "src/server.ts"]
