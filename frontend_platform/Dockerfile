FROM node:20-alpine AS builder
WORKDIR /app
ARG BACKEND_URL=http://localhost:8000
ENV BACKEND_URL=$BACKEND_URL

# Copy frontend package files into frontend_platform/
COPY frontend_platform/package.json frontend_platform/package-lock.json* ./frontend_platform/
RUN cd frontend_platform && npm install

# Copy source and shared lib
COPY frontend_platform/ ./frontend_platform/
COPY shared ./shared

# Build the Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p frontend_platform/public && cd frontend_platform && npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Monorepo standalone layout: server lives at frontend_platform/server.js
COPY --from=builder /app/frontend_platform/.next/standalone ./
COPY --from=builder /app/frontend_platform/.next/static ./frontend_platform/.next/static
COPY --from=builder /app/frontend_platform/public ./frontend_platform/public

EXPOSE 3000

CMD ["node", "frontend_platform/server.js"]
