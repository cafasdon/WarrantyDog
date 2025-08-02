# WarrantyDog Production Environment
# Optimized Alpine-based Node.js container for production deployment

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies (minimal for production)
RUN apk add --no-cache \
    bash \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 warrantydog && \
    adduser -D -s /bin/bash -u 1001 -G warrantydog warrantydog

# Set up application permissions
RUN chown -R warrantydog:warrantydog /app

# Switch to non-root user
USER warrantydog

# Copy package files first for better caching
COPY --chown=warrantydog:warrantydog package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY --chown=warrantydog:warrantydog . .

# Make scripts executable
RUN chmod +x docker-entrypoint.sh 2>/dev/null || true

# Expose WarrantyDog application port
EXPOSE 3001

# Default command - start WarrantyDog application
CMD ["./docker-entrypoint.sh"]

# Health check for WarrantyDog application
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Labels for metadata
LABEL maintainer="WarrantyDog Team"
LABEL description="Production WarrantyDog warranty checker application"
LABEL version="1.0.0"
