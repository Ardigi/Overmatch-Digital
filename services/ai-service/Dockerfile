# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install Python and build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy root package files for workspaces
COPY package*.json ./
COPY tsconfig*.json ./

# Copy shared packages
COPY packages/auth-common ./packages/auth-common
COPY shared/contracts ./shared/contracts
COPY shared/events ./shared/events

# Copy service files
COPY services/ai-service/package*.json ./services/ai-service/
COPY services/ai-service/tsconfig*.json ./services/ai-service/
COPY services/ai-service/nest-cli.json ./services/ai-service/

# Install all dependencies (workspace aware)
RUN npm install --workspaces

# Copy service source code
COPY services/ai-service/src ./services/ai-service/src

# Build shared packages first
WORKDIR /app/packages/auth-common
RUN npm run build || true

WORKDIR /app/shared/contracts
RUN npm run build || true

WORKDIR /app/shared/events
RUN npm run build || true

# Build the service
WORKDIR /app/services/ai-service
RUN npm run build

# Production stage
FROM node:20-alpine

# Install dumb-init for proper signal handling and curl for health checks
RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy service package files
COPY services/ai-service/package*.json ./services/ai-service/

# Copy built shared packages
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/shared ./shared

# Install production dependencies
WORKDIR /app
RUN npm install --workspaces --only=production && npm cache clean --force

# Copy built service
COPY --from=builder /app/services/ai-service/dist ./services/ai-service/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to service
WORKDIR /app/services/ai-service

# Expose service port
EXPOSE 3011

# Add health check with retry logic for external dependencies
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:3011/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main"]