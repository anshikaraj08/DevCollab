# ── Stage 1: Build Frontend Assets ──
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Build arguments for frontend environment injection
ARG VITE_API_URL=""
ARG VITE_SENTRY_DSN=""
ARG VITE_MONACO_BASE="/monaco"

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_MONACO_BASE=$VITE_MONACO_BASE

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

# ── Stage 2: Serve with Nginx ──
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
