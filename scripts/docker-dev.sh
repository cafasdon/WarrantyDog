#!/bin/bash

# WarrantyDog Docker Development Helper Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}🐕 WarrantyDog Development Environment${NC}"
    echo "=================================="
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_status "Docker is running ✓"
}

# Build the development container
build_container() {
    print_status "Building WarrantyDog development container..."
    docker-compose build
    if [ $? -eq 0 ]; then
        print_status "Container built successfully ✓"
    else
        print_error "Failed to build container"
        exit 1
    fi
}

# Start the development environment
start_dev() {
    print_status "Starting development environment..."
    docker-compose up -d
    
    # Wait a moment for container to start
    sleep 2
    
    # Run setup script inside container
    print_status "Running setup script..."
    docker-compose exec warrantydog-dev ./scripts/dev-setup.sh
    
    print_status "Development environment is ready!"
    echo ""
    echo "🚀 Quick commands:"
    echo "  docker-compose exec warrantydog-dev bash    # Enter container"
    echo "  docker-compose exec warrantydog-dev npm run dev    # Start dev server"
    echo "  docker-compose logs -f warrantydog-dev      # View logs"
    echo "  docker-compose down                         # Stop environment"
    echo ""
    echo "🌐 Access your app at: http://localhost:8080"
}

# Stop the development environment
stop_dev() {
    print_status "Stopping development environment..."
    docker-compose down
    print_status "Environment stopped ✓"
}

# Enter the development container
enter_container() {
    print_status "Entering development container..."
    docker-compose exec warrantydog-dev bash
}

# Show logs
show_logs() {
    docker-compose logs -f warrantydog-dev
}

# Clean up everything
clean() {
    print_warning "This will remove all containers and volumes. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up..."
        docker-compose down -v
        docker system prune -f
        print_status "Cleanup complete ✓"
    else
        print_status "Cleanup cancelled"
    fi
}

# Main script logic
case "$1" in
    "build")
        print_header
        check_docker
        build_container
        ;;
    "start")
        print_header
        check_docker
        build_container
        start_dev
        ;;
    "stop")
        print_header
        stop_dev
        ;;
    "restart")
        print_header
        stop_dev
        check_docker
        build_container
        start_dev
        ;;
    "shell"|"bash")
        enter_container
        ;;
    "logs")
        show_logs
        ;;
    "clean")
        print_header
        clean
        ;;
    "dev")
        print_status "Starting development server..."
        docker-compose exec warrantydog-dev npm run dev
        ;;
    *)
        print_header
        echo "Usage: $0 {build|start|stop|restart|shell|logs|clean|dev}"
        echo ""
        echo "Commands:"
        echo "  build    - Build the development container"
        echo "  start    - Start the development environment"
        echo "  stop     - Stop the development environment"
        echo "  restart  - Restart the development environment"
        echo "  shell    - Enter the development container"
        echo "  logs     - Show container logs"
        echo "  clean    - Clean up containers and volumes"
        echo "  dev      - Start the development server"
        echo ""
        echo "Examples:"
        echo "  $0 start     # Start everything"
        echo "  $0 shell     # Enter container for development"
        echo "  $0 dev       # Start dev server (run after 'shell')"
        exit 1
        ;;
esac
