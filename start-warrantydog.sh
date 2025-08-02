#!/bin/bash

# WarrantyDog Quick Start Script
# Starts WarrantyDog with immediate web availability

set -e

echo "🐕 WarrantyDog Quick Start"
echo "=========================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "🔧 Starting WarrantyDog application..."

# Stop any existing containers
echo "🛑 Stopping any existing WarrantyDog containers..."
docker-compose down > /dev/null 2>&1 || true

# Build and start the application
echo "🏗️  Building and starting WarrantyDog..."
docker-compose up --build -d

# Wait for the application to be ready
echo "⏳ Waiting for WarrantyDog to be ready..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ WarrantyDog is ready!"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ WarrantyDog failed to start within expected time"
        echo "📋 Container logs:"
        docker-compose logs --tail=20
        exit 1
    fi
    
    echo "🔄 Attempt $attempt/$max_attempts - Waiting for application..."
    sleep 2
    attempt=$((attempt + 1))
done

echo ""
echo "🎉 WarrantyDog is now running!"
echo "🌐 Web Interface: http://localhost:3001"
echo "📊 Health Check: http://localhost:3001/api/health"
echo "🔧 API Endpoints:"
echo "   - Dell API: http://localhost:3001/api/dell/warranty/:serviceTag"
echo "   - Lenovo API: http://localhost:3001/api/lenovo/warranty"
echo ""
echo "📋 Useful commands:"
echo "   - View logs: docker-compose logs -f"
echo "   - Stop application: docker-compose down"
echo "   - Restart application: docker-compose restart"
echo ""
echo "🚀 Ready to check warranties!"
