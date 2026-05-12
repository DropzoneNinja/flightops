# Production Dockerfile for React Frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and configuration
COPY . .

# Set environment variable for Vite build
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy main nginx configuration (controls worker processes)
COPY nginx-main.conf /etc/nginx/nginx.conf

# Copy server configuration as a template (envsubst fills ${NGINX_CLIENT_MAX_BODY_SIZE} at startup)
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Entrypoint: converts MAX_UPLOAD_SIZE (bytes) → nginx body size, then starts nginx
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
