# syntax=docker/dockerfile:1.7

FROM node:20-bookworm
WORKDIR /app

# PNPM
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Manifests pour caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY services/api/package.json services/api/tsconfig*.json services/api/prisma/schema.prisma ./services/api/

# Prefetch (accélère l'install)
RUN pnpm fetch --filter "./services/api"

# Copie complète
COPY . .

# Install + Prisma + build
RUN pnpm -C services/api install --no-frozen-lockfile \
 && pnpm -C services/api exec prisma generate \
 && pnpm -C services/api run build

ENV NODE_ENV=production \
    PORT=4001
EXPOSE 4001

# Lance l'API
CMD ["node","services/api/dist/main.js"]
