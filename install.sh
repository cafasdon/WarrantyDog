#!/bin/bash

# WarrantyDog One-Liner Installer
# Clones, builds, and starts WarrantyDog in one command

set -e

echo "🐕 WarrantyDog One-Liner Installer"
echo "=================================="

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if port 3001 is available
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3001 is already in use. Stopping any existing WarrantyDog containers..."
    docker stop warrantydog 2>/dev/null || true
    docker rm warrantydog 2>/dev/null || true
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo "📥 Cloning WarrantyDog repository..."
git clone https://github.com/cafasdon/WarrantyDog.git
cd WarrantyDog

echo "🔨 Building Docker container..."
docker build -t warrantydog .

echo "🚀 Starting WarrantyDog application..."
docker run -d -p 3001:3001 --name warrantydog warrantydog

# Wait for application to be ready
echo "⏳ Waiting for application to start..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ WarrantyDog is ready!"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "❌ Application failed to start within 30 seconds"
        exit 1
    fi
done

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo ""
echo "🎉 WarrantyDog is now running!"
echo "🌐 Open your browser to: http://localhost:3001"
echo ""
echo "📋 Useful commands:"
echo "   Stop:    docker stop warrantydog"
echo "   Start:   docker start warrantydog"
echo "   Remove:  docker stop warrantydog && docker rm warrantydog"
echo "   Logs:    docker logs warrantydog"
