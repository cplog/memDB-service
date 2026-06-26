FROM node:20-alpine
WORKDIR /app

COPY backend_platform/package.json backend_platform/package-lock.json* ./
RUN npm install --omit=dev

COPY backend_platform/src ./src
COPY backend_platform/tsconfig.json ./
COPY shared ../shared

ENV PORT=8000
EXPOSE 8000
CMD ["npm", "start"]
