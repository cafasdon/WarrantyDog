#!/bin/bash

# WarrantyDog Docker Deploy Script
# Complete deployment using Docker Compose

set -e

COMPOSE_FILE="docker-compose.production.yml"

echo "🐕 Deploying WarrantyDog with Docker Compose..."

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f $COMPOSE_FILE up --build -d

echo "✅ Deployment complete!"
echo "🌐 Application available at: http://localhost:3001"
echo "🔍 Health check: http://localhost:3001/api/health"

# Show service status
echo ""
echo "📊 Service Status:"
docker-compose -f $COMPOSE_FILE ps

# Show logs
echo ""
echo "📝 Recent logs:"
docker-compose -f $COMPOSE_FILE logs --tail 10

echo ""
echo "🛠️  Management commands:"
echo "   View logs:    docker-compose -f $COMPOSE_FILE logs -f"
echo "   Stop:         docker-compose -f $COMPOSE_FILE down"
echo "   Restart:      docker-compose -f $COMPOSE_FILE restart"
