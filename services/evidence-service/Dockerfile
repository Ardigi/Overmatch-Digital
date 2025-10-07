# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspaces
COPY package*.json ./
COPY tsconfig*.json ./

# Copy shared packages
COPY packages/auth-common ./packages/auth-common
COPY shared/events ./shared/events

# Copy service files
COPY services/evidence-service/package*.json ./services/evidence-service/
COPY services/evidence-service/tsconfig*.json ./services/evidence-service/
COPY services/evidence-service/nest-cli.json ./services/evidence-service/

# Install all dependencies (workspace aware)
RUN npm install --workspaces

# Copy service source code
COPY services/evidence-service/src ./services/evidence-service/src

# Build shared packages first
WORKDIR /app/packages/auth-common
RUN npm run build || true

WORKDIR /app/shared/events
RUN npm run build || true

# Build the service
WORKDIR /app/services/evidence-service
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and built packages
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/auth-common/package*.json ./packages/auth-common/
COPY --from=builder /app/packages/auth-common/dist ./packages/auth-common/dist
COPY --from=builder /app/shared/events/package*.json ./shared/events/
COPY --from=builder /app/shared/events/dist ./shared/events/dist
COPY --from=builder /app/services/evidence-service/package*.json ./services/evidence-service/

# Install production dependencies
WORKDIR /app/services/evidence-service
RUN npm install --omit=dev && npm cache clean --force

# Copy built application
COPY --from=builder /app/services/evidence-service/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3005

CMD ["node", "dist/main"]