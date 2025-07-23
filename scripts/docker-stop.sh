#!/bin/bash

# WarrantyDog Docker Stop Script
# Stops and cleans up WarrantyDog containers

set -e

CONTAINER_NAME="warrantydog-app"
COMPOSE_FILE="docker-compose.production.yml"

echo "🐕 Stopping WarrantyDog..."

# Stop Docker Compose services if running
if [ -f "$COMPOSE_FILE" ]; then
    echo "⏹️  Stopping Docker Compose services..."
    docker-compose -f $COMPOSE_FILE down
fi

# Stop standalone container if running
if docker ps -q -f name=$CONTAINER_NAME | grep -q .; then
    echo "⏹️  Stopping standalone container..."
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
fi

echo "✅ WarrantyDog stopped successfully!"

# Show remaining containers
echo ""
echo "📊 Remaining containers:"
docker ps -a | grep warrantydog || echo "No WarrantyDog containers running"
