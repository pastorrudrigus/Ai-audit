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

RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile

# ---------- builder ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @aigate/gateway build

# ---------- runner ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gateway

COPY --from=builder --chown=gateway:nodejs /app/apps/gateway/dist ./dist
COPY --from=builder --chown=gateway:nodejs /app/apps/gateway/package.json ./
COPY --from=builder --chown=gateway:nodejs /app/node_modules ./node_modules

USER gateway
EXPOSE 3001
ENV GATEWAY_PORT=3001

CMD ["node", "dist/server.js"]
