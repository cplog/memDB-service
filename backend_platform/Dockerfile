FROM node:20-alpine
WORKDIR /app

# Copy backend package files into backend_platform/
COPY backend_platform/package.json backend_platform/package-lock.json* ./backend_platform/
RUN cd backend_platform && npm install --omit=dev

# Copy backend source
COPY backend_platform/src ./backend_platform/src
COPY backend_platform/tsconfig.json ./backend_platform/
COPY shared ./shared

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "cd backend_platform && npm start"]
