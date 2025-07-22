#!/bin/bash

# WarrantyDog Internal Development Setup Script
# This script runs inside the Docker container to set up the development environment

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_status "Setting up WarrantyDog development environment..."

# Ensure we're in the right directory
cd /workspace

# Install npm dependencies if package.json exists
if [ -f "package.json" ]; then
    print_status "Installing npm dependencies..."
    npm install
    print_status "Dependencies installed ✓"
else
    print_warning "No package.json found, skipping npm install"
fi

# Create necessary directories
print_status "Creating project directories..."
mkdir -p lib examples docs tests
print_status "Directories created ✓"

# Download PapaParse if not present
if [ ! -f "lib/papaparse.min.js" ]; then
    print_status "Downloading PapaParse library..."
    curl -L "https://unpkg.com/papaparse@5.4.1/papaparse.min.js" -o "lib/papaparse.min.js"
    print_status "PapaParse downloaded ✓"
else
    print_status "PapaParse already exists ✓"
fi

# Create sample CSV if not present
if [ ! -f "examples/sample-devices.csv" ]; then
    print_status "Creating sample CSV file..."
    cat > examples/sample-devices.csv << 'EOF'
vendor,service_tag,description
Dell,ABC1234,Dell OptiPlex 7090
Dell,XYZ5678,Dell Latitude 5520
Dell,DEF9012,Dell PowerEdge R740
Lenovo,LEN001,ThinkPad X1 Carbon
HP,HP001,EliteBook 840 G8
EOF
    print_status "Sample CSV created ✓"
else
    print_status "Sample CSV already exists ✓"
fi

# Set proper permissions
print_status "Setting file permissions..."
chmod +x scripts/*.sh 2>/dev/null || true
print_status "Permissions set ✓"

# Create development documentation if not present
if [ ! -f "docs/development.md" ]; then
    print_status "Creating development documentation..."
    cat > docs/development.md << 'EOF'
# WarrantyDog Development Guide

## Quick Start

1. **Start development server**
   ```bash
   npm run dev
   ```

2. **Open browser**
   - Navigate to http://localhost:8080

## Development Commands

- `npm run dev` - Start live development server
- `npm run serve` - Start static HTTP server
- `npm run lint` - Check code quality
- `npm run format` - Format code

## File Structure

```
/workspace/
├── index.html          # Main application
├── app.js              # Core application logic
├── vendorApis.js       # API implementations
├── style.css           # Styling
├── lib/                # Third-party libraries
├── examples/           # Sample CSV files
├── docs/               # Documentation
└── tests/              # Test files
```

## API Configuration

Configure API keys in the browser console:
```javascript
localStorage.setItem('dell_api_key', 'your_api_key_here');
```

## Testing

Upload the sample CSV file from `examples/sample-devices.csv` to test the application.
EOF
    print_status "Development documentation created ✓"
fi

print_status "🎉 Development environment setup complete!"
echo ""
print_info "Available commands:"
echo "  npm run dev      # Start development server"
echo "  npm run serve    # Start static server"
echo "  npm run lint     # Check code quality"
echo "  npm run format   # Format code"
echo ""
print_info "Next steps:"
echo "1. Run: npm run dev"
echo "2. Open: http://localhost:8080"
echo "3. Configure Dell API key in browser console"
echo "4. Test with examples/sample-devices.csv"
