#!/bin/bash

# WarrantyDog Docker Run Script
# Runs the WarrantyDog container with proper configuration

set -e

CONTAINER_NAME="warrantydog-app"
IMAGE_NAME="warrantydog:latest"
PORT="3001"

echo "🐕 Starting WarrantyDog Container..."

# Stop existing container if running
if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    echo "⏹️  Stopping existing container..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

# Run the container
echo "🚀 Starting new container..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p $PORT:3001 \
    -e NODE_ENV=production \
    $IMAGE_NAME

echo "✅ Container started successfully!"
echo "🌐 Application available at: http://localhost:$PORT"
echo "🔍 Health check: http://localhost:$PORT/api/health"

# Show container status
echo ""
echo "📊 Container Status:"
docker ps -f name=$CONTAINER_NAME

# Show logs
echo ""
echo "📝 Recent logs:"
docker logs --tail 10 $CONTAINER_NAME
