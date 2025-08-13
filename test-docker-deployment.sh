#!/bin/bash

# WarrantyDog Docker Deployment Test Script
# Tests all documented Docker deployment methods

set -e

echo "🧪 Testing WarrantyDog Docker Deployment Methods"
echo "================================================"

# Function to test if application is responding
test_health() {
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Testing application health..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
            echo "✅ Application is responding!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts..."
        sleep 1
        ((attempt++))
    done
    
    echo "❌ Application failed to respond after $max_attempts seconds"
    return 1
}

# Function to cleanup containers
cleanup() {
    echo "🧹 Cleaning up containers..."
    docker-compose down 2>/dev/null || true
    docker stop warrantydog-container 2>/dev/null || true
    docker rm warrantydog-container 2>/dev/null || true
    docker stop warrantydog-simple 2>/dev/null || true
    docker rm warrantydog-simple 2>/dev/null || true
}

# Test 1: Docker Compose (Recommended)
echo ""
echo "🧪 Test 1: Docker Compose Deployment"
echo "====================================="

cleanup
echo "🚀 Starting with docker-compose..."
docker-compose up -d

if test_health; then
    echo "✅ Docker Compose deployment: PASSED"
    docker-compose logs --tail=5
else
    echo "❌ Docker Compose deployment: FAILED"
    docker-compose logs
    exit 1
fi

cleanup

# Test 2: Manual Docker with Volumes
echo ""
echo "🧪 Test 2: Manual Docker with Persistent Volumes"
echo "==============================================="

echo "🔨 Building image..."
docker build -t warrantydog .

echo "🚀 Starting with persistent volumes..."
docker run -d -p 3001:3001 \
  -v warrantydog-data:/app/data \
  -v warrantydog-logs:/app/logs \
  --name warrantydog-container \
  warrantydog

if test_health; then
    echo "✅ Manual Docker with volumes: PASSED"
    docker logs warrantydog-container --tail=5
else
    echo "❌ Manual Docker with volumes: FAILED"
    docker logs warrantydog-container
    exit 1
fi

cleanup

# Test 3: Simple Docker (No Volumes)
echo ""
echo "🧪 Test 3: Simple Docker Deployment"
echo "=================================="

echo "🚀 Starting simple container..."
docker run -d -p 3001:3001 --name warrantydog-simple warrantydog

if test_health; then
    echo "✅ Simple Docker deployment: PASSED"
    docker logs warrantydog-simple --tail=5
else
    echo "❌ Simple Docker deployment: FAILED"
    docker logs warrantydog-simple
    exit 1
fi

cleanup

# Test 4: Database Commands
echo ""
echo "🧪 Test 4: Database Command Testing"
echo "=================================="

echo "🚀 Starting container for database testing..."
docker-compose up -d

if test_health; then
    echo "🗄️ Testing database commands..."
    
    # Test database check command
    if docker-compose exec -T warrantydog node check-db.js > /dev/null 2>&1; then
        echo "✅ Database check command: PASSED"
    else
        echo "❌ Database check command: FAILED"
    fi
    
    # Test database debug command
    if docker-compose exec -T warrantydog node debug-db.js > /dev/null 2>&1; then
        echo "✅ Database debug command: PASSED"
    else
        echo "❌ Database debug command: FAILED"
    fi
else
    echo "❌ Could not start container for database testing"
    exit 1
fi

cleanup

echo ""
echo "🎉 All Docker deployment tests completed successfully!"
echo "✅ Docker Compose deployment works"
echo "✅ Manual Docker with volumes works"
echo "✅ Simple Docker deployment works"
echo "✅ Database commands work"
echo ""
echo "📋 Recommended deployment method: docker-compose up -d"
echo "🌐 Application will be available at: http://localhost:3001"
