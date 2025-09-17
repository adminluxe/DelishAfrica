# --- deps ---
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app

# Workspace files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/package.json

# Install only backend deps (workspaces)
RUN pnpm install --frozen-lockfile --filter ./backend...

# --- build ---
FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm --filter ./backend prisma generate
RUN pnpm --filter ./backend build

# --- runner ---
FROM node:20-alpine AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
# copy built backend
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/package.json ./package.json
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/backend/prisma ./prisma
# .env is injected at runtime via compose; can optionally COPY a default:
# COPY --from=build /app/backend/.env ./.env

EXPOSE 3000
CMD ["node","dist/main.js"]
