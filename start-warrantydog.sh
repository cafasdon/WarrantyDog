#!/bin/bash

# WarrantyDog Startup Script
# This script ensures proper Docker volume mounting for database persistence

echo "🐕 Starting WarrantyDog with persistent data storage..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Stop and remove existing container if it exists
echo "🧹 Cleaning up existing containers..."
docker stop warrantydog-container 2>/dev/null || true
docker rm warrantydog-container 2>/dev/null || true

# Build the latest image
echo "🔨 Building WarrantyDog Docker image..."
docker build -t warrantydog .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed. Please check the build output above."
    exit 1
fi

# Start with Docker Compose for proper volume management
if [ -f "docker-compose.yml" ]; then
    echo "🚀 Starting WarrantyDog with Docker Compose (recommended)..."
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        echo "✅ WarrantyDog started successfully with persistent storage!"
        echo "🌐 Access the application at: http://localhost:3001"
        echo "💾 Database data will persist between container restarts"
        echo "📊 Check status with: docker-compose logs -f"
    else
        echo "❌ Failed to start with Docker Compose, falling back to direct Docker run..."
        # Fallback to direct docker run
        docker run -d -p 3001:3001 -v warrantydog-data:/app/data -v warrantydog-logs:/app/logs --name warrantydog-container warrantydog
        
        if [ $? -eq 0 ]; then
            echo "✅ WarrantyDog started successfully with persistent storage!"
            echo "🌐 Access the application at: http://localhost:3001"
            echo "💾 Database data will persist between container restarts"
        else
            echo "❌ Failed to start WarrantyDog container."
            exit 1
        fi
    fi
else
    echo "🚀 Starting WarrantyDog with direct Docker run..."
    docker run -d -p 3001:3001 -v warrantydog-data:/app/data -v warrantydog-logs:/app/logs --name warrantydog-container warrantydog
    
    if [ $? -eq 0 ]; then
        echo "✅ WarrantyDog started successfully with persistent storage!"
        echo "🌐 Access the application at: http://localhost:3001"
        echo "💾 Database data will persist between container restarts"
    else
        echo "❌ Failed to start WarrantyDog container."
        exit 1
    fi
fi

echo ""
echo "📋 Useful commands:"
echo "  - View logs: docker logs warrantydog-container -f"
echo "  - Stop: docker stop warrantydog-container"
echo "  - Check database: docker exec warrantydog-container node check-db.js"
echo "  - Debug database: docker exec warrantydog-container node debug-db.js"
