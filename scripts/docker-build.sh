#!/bin/bash

# WarrantyDog Docker Build Script
# Builds the production Docker image

set -e

echo "🐕 Building WarrantyDog Production Docker Image..."

# Build the production image
docker build -f Dockerfile.production -t warrantydog:latest .

echo "✅ Docker image built successfully!"
echo "📦 Image: warrantydog:latest"

# Show image info
docker images warrantydog:latest

echo ""
echo "🚀 To run the container:"
echo "   docker run -p 3001:3001 warrantydog:latest"
echo ""
echo "🐳 Or use Docker Compose:"
echo "   docker-compose -f docker-compose.simple.yml up"
