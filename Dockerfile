# WarrantyDog Development Environment
# Alpine-based Node.js container for lightweight development

FROM node:18-alpine

# Set working directory
WORKDIR /workspace

# Install system dependencies
RUN apk add --no-cache \
    bash \
    git \
    curl \
    python3 \
    py3-pip \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Install global npm packages for development
RUN npm install -g \
    live-server \
    http-server \
    eslint \
    prettier

# Create non-root user for development
RUN addgroup -g 1001 developer && \
    adduser -D -s /bin/bash -u 1001 -G developer developer

# Set up workspace permissions
RUN chown -R developer:developer /workspace

# Switch to non-root user
USER developer

# Copy package files first for better caching
COPY --chown=developer:developer package*.json ./

# Install project dependencies
RUN npm install

# Copy project files
COPY --chown=developer:developer . .

# Make scripts executable
RUN chmod +x scripts/*.sh 2>/dev/null || true
RUN chmod +x docker-entrypoint.sh start-warrantydog.sh 2>/dev/null || true

# Expose WarrantyDog application port
EXPOSE 3001

# Default command - start WarrantyDog application
CMD ["./docker-entrypoint.sh"]

# Health check for WarrantyDog application
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Labels for metadata
LABEL maintainer="WarrantyDog Development Team"
LABEL description="Development environment for WarrantyDog warranty checker"
LABEL version="1.0.0"
