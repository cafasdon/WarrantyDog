#!/bin/bash

# WarrantyDog Docker Entrypoint Script
# Automatically starts the WarrantyDog application when container starts

set -e

echo "🐕 Starting WarrantyDog Application..."
echo "📅 $(date)"
echo "🔧 Environment: ${NODE_ENV:-production}"

# Function to check if the application is ready
check_app_ready() {
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for application to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
            echo "✅ Application is ready!"
            return 0
        fi
        
        echo "🔄 Attempt $attempt/$max_attempts - Application not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ Application failed to start within expected time"
    return 1
}

# Function to handle graceful shutdown
cleanup() {
    echo "🛑 Received shutdown signal..."
    if [ ! -z "$APP_PID" ]; then
        echo "🔄 Stopping WarrantyDog application (PID: $APP_PID)..."
        kill -TERM "$APP_PID" 2>/dev/null || true
        wait "$APP_PID" 2>/dev/null || true
    fi
    echo "✅ Graceful shutdown complete"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT

# Ensure we're in the correct directory
cd /workspace

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in /workspace"
    echo "📁 Current directory contents:"
    ls -la
    exit 1
fi

# Install dependencies if node_modules doesn't exist or is empty
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if server.js exists
if [ ! -f "server.js" ]; then
    echo "❌ server.js not found in /workspace"
    echo "📁 Current directory contents:"
    ls -la
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p data

# Set proper permissions for data directory
chmod 755 data

echo "🚀 Starting WarrantyDog server..."
echo "🌐 Application will be available at: http://localhost:3001"
echo "📊 Health check endpoint: http://localhost:3001/api/health"
echo "🔧 API endpoints:"
echo "   - Dell API: http://localhost:3001/api/dell/warranty/:serviceTag"
echo "   - Lenovo API: http://localhost:3001/api/lenovo/warranty"

# Start the application in the background
node server.js &
APP_PID=$!

echo "🔄 Application started with PID: $APP_PID"

# Wait for the application to be ready
if check_app_ready; then
    echo "🎉 WarrantyDog is now running and ready to accept requests!"
    echo "🌐 Open your browser to: http://localhost:3001"
else
    echo "❌ Failed to start WarrantyDog application"
    exit 1
fi

# Keep the script running and wait for the application process
wait "$APP_PID"
