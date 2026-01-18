# Production Dockerfile for NestJS Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci

# Copy source code (including assets)
COPY src ./src

# Build application (nest will copy assets to dist/assets)
RUN npm run build

# Verify assets were copied
RUN ls -la /app/dist/assets/ || echo "Warning: No assets directory found"

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder (includes assets in dist/assets via nest-cli.json)
COPY --from=builder /app/dist ./dist

# Verify assets are present
RUN ls -la /app/dist/assets/ && echo "✓ Assets found in dist/assets"

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/main"]
