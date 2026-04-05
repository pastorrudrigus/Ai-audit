FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# Install dependencies
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/gateway/package.json ./apps/gateway/
COPY packages/db/package.json ./packages/db/
COPY packages/core/package.json ./packages/core/

RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx turbo build --filter=@aigate/gateway

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 gateway

COPY --from=builder --chown=gateway:nodejs /app/apps/gateway/dist ./dist
COPY --from=builder --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=gateway:nodejs /app/apps/gateway/package.json ./

USER gateway

EXPOSE 3001
ENV GATEWAY_PORT=3001

CMD ["node", "dist/server.js"]
