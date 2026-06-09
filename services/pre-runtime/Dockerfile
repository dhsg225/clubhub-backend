FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY services/pre-runtime/package.json ./services/pre-runtime/
RUN pnpm install --frozen-lockfile --filter @clubhub/pre-runtime...

FROM deps AS builder
COPY services/pre-runtime/ ./services/pre-runtime/
RUN pnpm --filter @clubhub/pre-runtime build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/pre-runtime/dist ./dist
COPY --from=builder /app/services/pre-runtime/package.json ./
EXPOSE 7777
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:7777/health || exit 1
CMD ["node", "dist/index.js"]
