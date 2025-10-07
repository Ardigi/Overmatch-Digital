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
COPY services/reporting-service/package*.json ./services/reporting-service/
COPY services/reporting-service/tsconfig*.json ./services/reporting-service/
COPY services/reporting-service/nest-cli.json ./services/reporting-service/

# Install all dependencies (workspace aware)
RUN npm install --workspaces

# Copy service source code
COPY services/reporting-service/src ./services/reporting-service/src

# Build shared packages first
WORKDIR /app/packages/auth-common
RUN npm run build || true

WORKDIR /app/shared/contracts
RUN npm run build || true

WORKDIR /app/shared/events
RUN npm run build || true

# Build the service
WORKDIR /app/services/reporting-service
RUN npm run build

# Production stage
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy service package files
COPY services/reporting-service/package*.json ./services/reporting-service/

# Copy built shared packages
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/shared ./shared

# Install production dependencies
WORKDIR /app
RUN npm install --workspaces --only=production && npm cache clean --force

# Copy built service
COPY --from=builder /app/services/reporting-service/dist ./services/reporting-service/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to service
WORKDIR /app/services/reporting-service

# Expose service port
EXPOSE 3007

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3007/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main"]