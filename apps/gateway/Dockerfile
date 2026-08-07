# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
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
# Sem build step separado: o gateway roda TypeScript direto com tsx.
# tsx transpila on-the-fly e resolve os workspace packages via symlink,
# evitando o problema de packages/*/package.json apontar "main" pra .ts
# que quebra em Node ESM puro.
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

WORKDIR /app/apps/gateway
CMD ["node", "--import", "tsx/esm", "server.ts"]
