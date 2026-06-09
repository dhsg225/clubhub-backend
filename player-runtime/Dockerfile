FROM node:20-slim

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY turbo.json ./
COPY tsconfig.base.json ./

# Copy packages needed
COPY packages/pre-types ./packages/pre-types
COPY packages/constitutional-types ./packages/constitutional-types
COPY packages/fnv-checksum ./packages/fnv-checksum
COPY packages/telemetry-sdk ./packages/telemetry-sdk

# Copy service
COPY player-runtime ./player-runtime

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @clubhub/player-runtime build

ENV NODE_ENV=production

WORKDIR /app/player-runtime
CMD ["node", "dist/index.js"]
