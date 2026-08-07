# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat postgresql-client
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# ---------- deps ----------
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/gateway/package.json ./apps/gateway/
COPY packages/db/package.json ./packages/db/
COPY packages/core/package.json ./packages/core/
COPY packages/verify/package.json ./packages/verify/

RUN pnpm install --frozen-lockfile

# ---------- runner ----------
# tsx roda TS direto em vez de compilar (o gateway compilava via tsc mas
# os workspace packages apontam "main" pra .ts e Node ESM quebra em
# directory imports). psql aplica as migrations no boot — idempotente
# com IF NOT EXISTS / EXCEPTION.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gateway

COPY --from=deps --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --chown=gateway:nodejs apps/gateway ./apps/gateway
COPY --chown=gateway:nodejs packages ./packages
COPY --chown=gateway:nodejs package.json pnpm-workspace.yaml ./

USER gateway
EXPOSE 3001
ENV GATEWAY_PORT=3001

CMD ["sh", "-c", "psql \"$DATABASE_URL\" -v ON_ERROR_STOP=0 -f /app/packages/db/all-migrations.sql 2>&1 | tail -20 && cd /app/apps/gateway && export GATEWAY_PORT=${PORT:-3001} && exec node --import tsx server.ts"]
