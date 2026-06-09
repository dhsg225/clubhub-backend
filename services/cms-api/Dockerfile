FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/cms-api/package.json ./services/cms-api/
RUN pnpm install --frozen-lockfile --filter @clubhub/cms-api...

COPY services/cms-api/ ./services/cms-api/
RUN pnpm --filter @clubhub/cms-api build

ENV NODE_ENV=production
WORKDIR /app/services/cms-api
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/index.js"]
