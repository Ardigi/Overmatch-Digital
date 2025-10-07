# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install Python and build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy root package files for workspaces
COPY package*.json ./
COPY tsconfig*.json ./

# Copy shared packages
COPY packages/auth-common ./packages/auth-common
COPY packages/http-common ./packages/http-common
COPY packages/monitoring ./packages/monitoring
COPY shared/events ./shared/events
COPY shared/contracts ./shared/contracts

# Copy service files
COPY services/control-service/package*.json ./services/control-service/
COPY services/control-service/tsconfig*.json ./services/control-service/
COPY services/control-service/nest-cli.json ./services/control-service/

# Install all dependencies (workspace aware)
RUN npm install --workspaces --legacy-peer-deps

# Copy service source code
COPY services/control-service/src ./services/control-service/src

# Build shared packages first
WORKDIR /app/packages/auth-common
RUN npm run build

WORKDIR /app/packages/http-common
RUN npm run build

WORKDIR /app/packages/monitoring
RUN npm run build

WORKDIR /app/shared/events
RUN npm run build

WORKDIR /app/shared/contracts
RUN npm run build

# Build the service
WORKDIR /app/services/control-service
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and built packages
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/auth-common/package*.json ./packages/auth-common/
COPY --from=builder /app/packages/auth-common/dist ./packages/auth-common/dist
COPY --from=builder /app/packages/http-common/package*.json ./packages/http-common/
COPY --from=builder /app/packages/http-common/dist ./packages/http-common/dist
COPY --from=builder /app/packages/monitoring/package*.json ./packages/monitoring/
COPY --from=builder /app/packages/monitoring/dist ./packages/monitoring/dist
COPY --from=builder /app/shared/events/package*.json ./shared/events/
COPY --from=builder /app/shared/events/dist ./shared/events/dist
COPY --from=builder /app/shared/contracts/package*.json ./shared/contracts/
COPY --from=builder /app/shared/contracts/dist ./shared/contracts/dist
COPY --from=builder /app/services/control-service/package*.json ./services/control-service/

# Install production dependencies
WORKDIR /app
RUN npm install --production --workspaces --legacy-peer-deps && npm cache clean --force

# Copy built application
COPY --from=builder /app/services/control-service/dist ./services/control-service/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/services/control-service

EXPOSE 3004

CMD ["node", "dist/main"]