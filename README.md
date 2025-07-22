
# WarrantyDog 🐕

A browser-based warranty checker that fetches warranty information from multiple hardware vendors using their APIs.

## 🚀 Quick Start with Docker

### Prerequisites
- Docker Desktop installed and running
- Git

### One-Command Setup
```bash
git clone https://github.com/yourusername/WarrantyDog.git
cd WarrantyDog
chmod +x scripts/*.sh
./scripts/complete-setup.sh
```

### Start Development
```bash
make shell          # Enter development container
npm run dev         # Start development server
```

Then open http://localhost:8080 in your browser.

## 🐳 Docker Development Environment

WarrantyDog uses Docker for consistent development across all platforms.

### Available Commands

```bash
# Setup and Management
make setup          # Initial setup
make start          # Start development environment
make stop           # Stop development environment
make restart        # Restart everything
make clean          # Clean up containers and volumes

# Development
make shell          # Enter development container
make dev            # Start development server
make logs           # View container logs

# Code Quality
make test           # Run tests
make lint           # Run linter
make format         # Format code

# Help
make help           # Show all commands
```

### Manual Docker Commands

```bash
# Build and start
docker-compose build
docker-compose up -d

# Enter container
docker-compose exec warrantydog-dev bash

# Start development server
docker-compose exec warrantydog-dev npm run dev

# Stop everything
docker-compose down
```

## 📋 CSV Format

Your input CSV must contain these columns:
- `vendor` - Vendor name (Dell, Lenovo, HP, etc.)
- `serial` - Device serial number

Optional columns:
- `model` - Device model
- `location` - Device location

Example:
```csv
vendor,serial,model,location
Dell,ABCD123,OptiPlex 7090,Office-Floor1
Lenovo,XYZ789,ThinkPad X1,Office-Floor2
HP,DEF456,EliteBook 840,Remote-User1
```

## ⚙️ Configuration

### API Keys

Configure API keys through the web interface:
1. Click "⚙️ Configure APIs" in the app
2. Enter your Dell API key
3. Click "Save"

Or via browser console:
```javascript
localStorage.setItem('dell_api_key', 'your_dell_api_key_here');
```

### Supported Vendors

| Vendor | Status | API Documentation | CORS Support |
|--------|--------|-------------------|--------------|
| Dell | ✅ Implemented | [Dell API Docs](https://www.dell.com/support/kbdoc/en-us/000177999) | ✅ Yes |
| Lenovo | 🚧 Planned | [Lenovo API Docs](https://support.lenovo.com/us/en/api-doc) | ❓ TBD |
| HP | 🚧 Planned | [HP API Docs](https://developers.hp.com/) | ❓ TBD |

## 🏗️ Architecture

```
WarrantyDog/
├── index.html              # Main app with modal config
├── app.js                  # Core logic with WarrantyChecker class
├── vendorApis.js           # API implementations + rate limiting
├── style.css               # Responsive styling
├── package.json            # Node.js config with dev scripts
├── Dockerfile              # Alpine-based dev container
├── docker-compose.yml      # Container orchestration
├── Makefile               # Development commands
├── .gitignore             # Comprehensive exclusions
├── scripts/
│   ├── complete-setup.sh   # One-command setup
│   ├── docker-dev.sh       # Container management
│   └── dev-setup.sh        # Internal setup
├── docs/                   # Complete documentation
├── examples/               # Sample CSV files
└── lib/                    # PapaParse library
```

## 🧪 Testing

### Automated Testing
```bash
make test
```

### Manual Testing
1. Start the development server
2. Upload `examples/sample-devices.csv`
3. Configure Dell API key
4. Verify warranty data is fetched
5. Export results and verify CSV format

### Sample Data
- `examples/sample-devices.csv` - Mixed vendor sample
- `examples/test-dell.csv` - Dell-specific test data

## 🚀 Deployment

### Static Hosting
The application is pure HTML/CSS/JavaScript and can be deployed to any static host:

```bash
# Build production files
make format
make lint

# Deploy files to your hosting platform
# - GitHub Pages
# - Netlify
# - Vercel
# - AWS S3 + CloudFront
```

### Environment Variables
No server-side environment variables needed. All configuration is client-side.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes in the Docker environment
4. Test thoroughly
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📚 Documentation

- [Development Guide](docs/development.md) - Docker setup and workflow
- [API Documentation](docs/api.md) - Vendor API integration details
- [Deployment Guide](docs/deployment.md) - Production deployment
- [Troubleshooting](docs/troubleshooting.md) - Common issues and solutions

## 🐛 Troubleshooting

### Container Issues
```bash
# Container won't start
make clean
make start

# Permission issues
sudo chown -R $USER:$USER .

# Port conflicts
make stop
make start
```

### API Issues
```bash
# Check API key configuration
# Open browser console:
localStorage.getItem('dell_api_key')

# Test API directly
# In browser console:
fetch('https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements?servicetags=TEST123', {
  headers: { 'X-Dell-Api-Key': 'your_key' }
})
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏷️ Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

---

**Made with ❤️ for IT professionals who need warranty information fast.**

**Development powered by Docker 🐳**

# On GitHub, create a new private repository named "WarrantyDog"







