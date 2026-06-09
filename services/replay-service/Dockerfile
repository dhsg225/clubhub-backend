FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY services/replay-service/package.json ./services/replay-service/
RUN pnpm install --frozen-lockfile --filter @clubhub/replay-service...

FROM deps AS builder
COPY services/replay-service/ ./services/replay-service/
RUN pnpm --filter @clubhub/replay-service build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/replay-service/dist ./dist
COPY --from=builder /app/services/replay-service/package.json ./
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["node", "dist/index.js"]
