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

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application
COPY . .

# Set ownership
RUN chown -R warrantydog:warrantydog /app

# Switch to non-root user
USER warrantydog

# Expose port
EXPOSE 3001

# Start application directly
CMD ["node", "server.js"]
