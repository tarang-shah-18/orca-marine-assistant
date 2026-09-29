# ORCA Marine Intelligence Platform — container
#
# Two-stage build: the app is compiled with Vite (web bundle) and esbuild
# (server.cjs), then the runtime image keeps only production dependencies and
# the built artifacts. No API keys are needed — the engine is deterministic
# and offline-capable end to end.

# ---- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Layer caching: dependencies first, then the sources.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Writable path for `ORCA_SESSIONS_FILE` (named volume in docker-compose).
RUN mkdir -p /data && chown node:node /data

COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

# Liveness probe: the API responds with status ok as soon as the process is up.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "dist/server.cjs"]