# Stage 1: Build Svelte Dashboard
FROM node:20-slim AS dashboard-builder
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# Stage 2: Build TypeScript Backend
FROM node:20-slim AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/data/agentsig.db

# Create data dir for persistent volume
RUN mkdir -p /data

# Copy built artifacts
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package.json ./
COPY --from=dashboard-builder /app/dashboard/dist ./public/dashboard

EXPOSE 3000
VOLUME ["/data"]

CMD ["node", "dist/index.js"]
