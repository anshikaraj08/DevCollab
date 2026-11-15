# ── Stage 1: Production Dependencies ──
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime Image ──
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Install dumb-init for init process handling and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Copy production dependencies and application sources
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
# Copy the whole backend; .dockerignore keeps out node_modules, tests and .env files.
# (Listing folders one by one previously left out validators/ and crashed on boot.)
COPY . .

# Run as non-root user for security
USER node

EXPOSE 5000

# Health check against /healthz
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/healthz || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]

