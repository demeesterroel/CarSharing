# syntax=docker/dockerfile:1

# Stage 1 — builder: compile native modules and build Next.js
FROM node:20-alpine AS builder
WORKDIR /app

# better-sqlite3 builds from source on alpine; it needs python/make/g++
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune dev dependencies; keeps the compiled better-sqlite3 .node binary
RUN npm prune --omit=dev

# Stage 2 — runner: minimal image, no build toolchain
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone server bundle + static assets + public files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

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
