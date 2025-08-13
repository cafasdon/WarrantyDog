# WarrantyDog - Self-Contained Alpine Container
FROM alpine:3.22

# Install Node.js and tools
RUN apk add --no-cache nodejs npm bash curl

# Set working directory
WORKDIR /app

# Create user
RUN addgroup -g 1001 warrantydog && \
    adduser -D -s /bin/bash -u 1001 -G warrantydog warrantydog

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci && npm cache clean --force

# Copy application source
COPY . .

# Build TypeScript application
RUN npm run build

# Remove dev dependencies after build
RUN npm ci --only=production && npm cache clean --force

# Set ownership
RUN chown -R warrantydog:warrantydog /app

# Switch to non-root user
USER warrantydog

# Expose port
EXPOSE 3001

# Start application from compiled output
CMD ["node", "dist/src/server.js"]
