FROM node:20-alpine AS builder
WORKDIR /app

# Copy frontend package files
COPY frontend_platform/package.json frontend_platform/package-lock.json* ./
RUN npm install

# Copy source and shared lib
COPY frontend_platform/ ./
COPY shared ../shared

# Build the Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy built app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
