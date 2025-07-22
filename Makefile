# WarrantyDog Development Makefile

.PHONY: help build start stop restart shell logs clean dev test lint format setup

# Default target
help:
	@echo "🐕 WarrantyDog Development Commands"
	@echo "=================================="
	@echo ""
	@echo "Setup:"
	@echo "  make setup     - Initial project setup"
	@echo "  make build     - Build development container"
	@echo ""
	@echo "Development:"
	@echo "  make start     - Start development environment"
	@echo "  make dev       - Start development server"
	@echo "  make shell     - Enter development container"
	@echo "  make stop      - Stop development environment"
	@echo "  make restart   - Restart development environment"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs      - Show container logs"
	@echo "  make test      - Run tests"
	@echo "  make lint      - Run linter"
	@echo "  make format    - Format code"
	@echo "  make clean     - Clean up containers and volumes"
	@echo ""
	@echo "Quick start: make setup && make start && make shell"

# Initial setup
setup:
	@echo "🐕 Setting up WarrantyDog..."
	chmod +x scripts/*.sh
	./scripts/docker-dev.sh build

# Build container
build:
	./scripts/docker-dev.sh build

# Start development environment
start:
	./scripts/docker-dev.sh start

# Stop development environment
stop:
	./scripts/docker-dev.sh stop

# Restart development environment
restart:
	./scripts/docker-dev.sh restart

# Enter development container
shell:
	./scripts/docker-dev.sh shell

# Show logs
logs:
	./scripts/docker-dev.sh logs

# Start development server
dev:
	./scripts/docker-dev.sh dev

# Run tests
test:
	docker-compose exec warrantydog-dev npm test

# Run linter
lint:
	docker-compose exec warrantydog-dev npm run lint

# Format code
format:
	docker-compose exec warrantydog-dev npm run format

# Clean up
clean:
	./scripts/docker-dev.sh clean

# Git helpers
git-setup:
	@echo "Setting up git hooks..."
	@echo "#!/bin/bash" > .git/hooks/pre-commit
	@echo "make lint" >> .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "✅ Git hooks installed"

# Full development setup
full-setup: setup start
	@echo ""
	@echo "🎉 WarrantyDog is ready for development!"
	@echo ""
	@echo "Next steps:"
	@echo "1. make shell          # Enter development container"
	@echo "2. npm run dev         # Start development server"
	@echo "3. Open http://localhost:8080"

# Local development (without Docker)
local-setup:
	@echo "🐕 Setting up local development..."
	npm install
	./scripts/setup.sh
	@echo "✅ Local setup complete"
	@echo "Run: npm run dev"

# Local development server
local-dev:
	npm run dev

# Local testing
local-test:
	npm test

# Validate project structure
validate:
	@echo "🔍 Validating project structure..."
	@test -f index.html || (echo "❌ index.html missing" && exit 1)
	@test -f app.js || (echo "❌ app.js missing" && exit 1)
	@test -f vendorApis.js || (echo "❌ vendorApis.js missing" && exit 1)
	@test -f style.css || (echo "❌ style.css missing" && exit 1)
	@test -f package.json || (echo "❌ package.json missing" && exit 1)
	@test -f lib/papaparse.min.js || (echo "❌ PapaParse library missing" && exit 1)
	@test -f examples/sample-devices.csv || (echo "❌ Sample CSV missing" && exit 1)
	@echo "✅ Project structure is valid"

# Production build
production:
	@echo "🚀 Preparing production build..."
	npm run lint
	npm run format
	npm run test
	@echo "✅ Production build ready"
	@echo "Files ready for deployment:"
	@echo "  - index.html"
	@echo "  - app.js"
	@echo "  - vendorApis.js"
	@echo "  - style.css"
	@echo "  - lib/"

# Documentation
docs:
	@echo "📚 WarrantyDog Documentation"
	@echo "============================"
	@echo ""
	@echo "📖 Available documentation:"
	@echo "  - README.md           # Main project documentation"
	@echo "  - docs/api.md         # API documentation"
	@echo "  - docs/development.md # Development guide"
	@echo "  - CONTRIBUTING.md     # Contribution guidelines"
	@echo "  - CHANGELOG.md        # Version history"
	@echo ""
	@echo "🌐 Online resources:"
	@echo "  - GitHub Repository"
	@echo "  - Issue Tracker"
	@echo "  - Wiki"

# Status check
status:
	@echo "🐕 WarrantyDog Status"
	@echo "===================="
	@echo ""
	@echo "📁 Project files:"
	@ls -la | grep -E '\.(html|js|css|json|md)$$' || echo "  No project files found"
	@echo ""
	@echo "📦 Dependencies:"
	@test -f package.json && echo "  ✅ package.json exists" || echo "  ❌ package.json missing"
	@test -f lib/papaparse.min.js && echo "  ✅ PapaParse library installed" || echo "  ❌ PapaParse library missing"
	@echo ""
	@echo "🐳 Docker:"
	@docker --version 2>/dev/null && echo "  ✅ Docker available" || echo "  ❌ Docker not available"
	@docker-compose --version 2>/dev/null && echo "  ✅ Docker Compose available" || echo "  ❌ Docker Compose not available"
	@echo ""
	@echo "🔧 Development tools:"
	@node --version 2>/dev/null && echo "  ✅ Node.js available" || echo "  ❌ Node.js not available"
	@npm --version 2>/dev/null && echo "  ✅ npm available" || echo "  ❌ npm not available"
