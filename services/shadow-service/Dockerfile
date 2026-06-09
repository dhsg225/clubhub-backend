FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY services/shadow-service/package.json ./services/shadow-service/
RUN pnpm install --frozen-lockfile --filter @clubhub/shadow-service...

FROM deps AS builder
COPY services/shadow-service/ ./services/shadow-service/
RUN pnpm --filter @clubhub/shadow-service build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/shadow-service/dist ./dist
COPY --from=builder /app/services/shadow-service/package.json ./
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3005/health || exit 1
CMD ["node", "dist/index.js"]
