# syntax=docker/dockerfile:1

# Stage 1 — builder: build Next.js
# node:20-slim (Debian/glibc) lets better-sqlite3 use its pre-built binary,
# so no python/make/g++ toolchain is needed.
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN SESSION_PASSWORD=build-placeholder npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# Stage 2 — runner: minimal image, no build toolchain
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 -g nodejs nextjs

# Standalone server bundle + static assets + public files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# SQL migration files — applied automatically on first DB access at startup
COPY --from=builder --chown=nextjs:nodejs /app/migrations      ./migrations

# better-sqlite3 is marked serverExternal, so standalone doesn't bundle it —
# copy the pruned node_modules so `require("better-sqlite3")` resolves at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings        ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Writable data + uploads mount points
RUN mkdir -p /app/data /app/uploads && chown -R nextjs:nodejs /app/data /app/uploads

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
