# =====================================================================
#  HR-ATS frontend (React + Vite)
#  development -> Vite dev server | production -> static files on nginx
# =====================================================================

FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
# esbuild needs its postinstall to place the platform binary.
RUN npm ci --ignore-scripts=false --foreground-scripts

# ---------------------------------------------------------------------
#  Development: Vite dev server with hot reload
# ---------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
# --host binds to 0.0.0.0 so the port is reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------
#  Build
# ---------------------------------------------------------------------
FROM base AS build
# Vite inlines VITE_* values at build time, so the API URL must be
# supplied here rather than at container start.
ARG VITE_API_BASE_URL=http://localhost:8000/api
ARG VITE_APP_NAME="HR ATS"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------
#  Production: static assets served by nginx as a non-root user
# ---------------------------------------------------------------------
FROM nginx:1.27-alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx:alpine ships an unprivileged `nginx` user; give it the paths it
# needs so the container does not have to run as root.
RUN touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
