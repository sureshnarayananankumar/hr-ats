# =====================================================================
#  HR-ATS backend (NestJS)
#  Multi-stage: deps -> development | build -> production
# =====================================================================

# ---------------------------------------------------------------------
#  Base: shared OS packages
# ---------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
# openssl is required by Prisma's query engine.
# dumb-init gives us correct signal handling for graceful shutdown.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl dumb-init ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=development

# ---------------------------------------------------------------------
#  Dependencies
# ---------------------------------------------------------------------
FROM base AS deps
COPY package*.json ./
# npm 11 blocks lifecycle scripts by default; Prisma's engine download
# and argon2's native binding both need theirs to run.
RUN npm ci --ignore-scripts=false --foreground-scripts \
    && npm rebuild argon2 --build-from-source=false || npm rebuild argon2

# ---------------------------------------------------------------------
#  Development target: full toolchain, hot reload, Prisma CLI available
# ---------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev"]

# ---------------------------------------------------------------------
#  Build: compile TypeScript and prune to production dependencies
# ---------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build
# Keep the generated Prisma client, which lives inside node_modules.
RUN npm prune --omit=dev && npx prisma generate

# ---------------------------------------------------------------------
#  Production: minimal image, non-root user
# ---------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production

# Run as an unprivileged user. The node image ships a `node` user (1000).
RUN mkdir -p /app/storage && chown -R node:node /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package*.json ./

USER node
EXPOSE 3000

# Fails the container's health check if the API stops answering.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
