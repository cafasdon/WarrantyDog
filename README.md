
# WarrantyDog 🐕

**A modern, browser-based warranty checker that fetches warranty information from multiple hardware vendors using their APIs.**

✅ **Production Ready** | 🐳 **Docker Containerized** | 🔒 **Secure OAuth 2.0** | 🚀 **Modern Stack**

---

## 🎯 **What is WarrantyDog?**

WarrantyDog is a complete warranty management solution that:
- **Processes CSV files** with device information
- **Fetches warranty data** from vendor APIs (Dell, Lenovo, HP)
- **Provides real-time progress** tracking with cancellation
- **Exports complete results** to CSV
- **Runs anywhere** with Docker containerization

### ✨ **Key Features**
- ✅ **Dell OAuth 2.0 Integration**: Full API authentication with rate limiting
- ✅ **Lenovo API Support**: Complete warranty lookup functionality
- ✅ **Smart Processing**: Skips unconfigured vendors to save API quotas
- ✅ **Modern Development**: Vite dev server, secure dependencies
- ✅ **Docker Ready**: One-command deployment anywhere
- ✅ **Data Persistence**: SQLite database with session management
- ✅ **Professional UX**: Real-time updates, error handling, export functionality

### 🏗️ **Architecture**
- **Frontend**: Modern JavaScript with Vite development server
- **Backend**: Node.js/Express API proxy with OAuth 2.0 token management
- **Database**: SQLite for session persistence and caching
- **Deployment**: Docker containerization for consistent environments
- **Security**: Fixed all high/medium vulnerabilities, modern dependency stack

---

## 🚀 **Quick Start Guide**

### 📋 **Prerequisites**
- **Docker Desktop** installed and running ([Download here](https://www.docker.com/products/docker-desktop/))
- **Git** installed ([Download here](https://git-scm.com/downloads))

### 🎯 **One-Command Start**

**Clone and start the application:**
```bash
git clone https://github.com/cafasdon/WarrantyDog.git
cd WarrantyDog
docker-compose up --build -d
```

**That's it!** The application will be available at **http://localhost:3001**

> **✅ Self-Sufficient Container**: The application starts automatically when the container launches - no external scripts needed!

### 🐳 **Docker Commands**

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop when done
docker-compose down
```

### 🌐 **Access Your Application**
- **Main Application**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health
- **API Documentation**: http://localhost:3001/api/

### ✅ **Verify Installation**
1. Open http://localhost:3001 in your browser
2. You should see the WarrantyDog interface
3. Click "⚙️ Configure APIs" to set up vendor credentials
4. Upload a CSV file to test functionality

---

## 🛠️ **Development Setup**

### 🎯 **Local Development (For Developers)**

**Prerequisites:**
- Node.js 16+ ([Download here](https://nodejs.org/))
- npm (comes with Node.js)

**Setup:**
```bash
# Clone repository
git clone https://github.com/cafasdon/WarrantyDog.git
cd WarrantyDog

# Install dependencies
npm install

# Start backend server (production)
npm run server

# OR start development server with hot reload
npm run dev-server

# OR start frontend development server
npm run dev
```

**Access Points:**
- **Backend + Frontend**: http://localhost:3001 (production)
- **Frontend Only**: http://localhost:8080 (development)
- **Backend API**: http://localhost:3001/api/

### 🔧 **Development Commands**
```bash
npm run dev          # Start Vite development server (port 8080)
npm run server       # Start backend API server (port 3001)
npm run dev-server   # Start backend with auto-restart
npm run lint         # Check code quality
npm run format       # Format code with Prettier
npm run validate     # Run lint + format
```

---

## 📋 **How to Use WarrantyDog**

### 📁 **Step 1: Prepare Your CSV File**

Create a CSV file with your device information:

**Required columns:**
- `vendor` - Device manufacturer (Dell, Lenovo, HP, etc.)
- `serial` - Device serial number

**Optional columns:**
- `model` - Device model name
- `location` - Device location

**Example CSV:**
```csv
vendor,serial,model,location
Dell,ABCD123,OptiPlex 7090,Office-Floor1
Dell,EFGH456,Latitude 5520,Remote-User1
Lenovo,IJKL789,ThinkPad X1,Office-Floor2
HP,MNOP012,EliteBook 840,Remote-User2
```

### 🔑 **Step 2: Configure API Credentials**

1. **Get Dell API Credentials** (if checking Dell devices):
   - Visit [Dell TechDirect API Portal](https://techdirect.dell.com/portal/AboutAPIs.aspx)
   - Request API access through your Dell account
   - You'll receive both an **API Key** and **API Secret**

2. **Get Lenovo API Credentials** (if checking Lenovo devices):
   - Visit [Lenovo Support API Portal](https://supportapi.lenovo.com/documentation/)
   - Request API access and get your **Client ID**

3. **Configure in WarrantyDog**:
   - Open http://localhost:3001
   - Click "⚙️ Configure APIs"
   - Enter your credentials
   - Click "🧪 Test API Connection" to verify
   - Save your configuration

### 📤 **Step 3: Process Your Devices**

1. **Upload CSV**: Click "Choose File" and select your CSV
2. **Review Data**: Verify the device list is parsed correctly
3. **Start Processing**: Click "🔍 Check Warranties"
4. **Monitor Progress**: Watch real-time progress with cancel option
5. **Export Results**: Click "📥 Export CSV" when complete

### 📊 **Step 4: Review Results**

Your results will include:
- ✅ **Warranty Status**: Active, Expired, or Error
- 📅 **Warranty End Date**: When coverage expires
- 🏷️ **Warranty Type**: Service level details
- 📦 **Ship Date**: Original device ship date
- 🏭 **Vendor**: Standardized vendor name
- 📱 **Model**: Cleaned device model information

---

## 🔧 **Supported Vendors & APIs**

| Vendor | Status | Authentication | Rate Limits | Documentation |
|--------|--------|----------------|-------------|---------------|
| **Dell** | ✅ **Fully Working** | OAuth 2.0 (Key + Secret) | 1000/day | [Dell TechDirect API](https://techdirect.dell.com/portal/AboutAPIs.aspx) |
| **Lenovo** | ✅ **Fully Working** | Client ID | 1000/day | [Lenovo Support API](https://supportapi.lenovo.com/documentation/) |
| **HP** | 🚧 **Planned** | TBD | TBD | [HP Developer Portal](https://developers.hp.com/) |

### 🔑 **API Configuration Details**

**Dell API Setup:**
1. **Register**: Create account at [Dell TechDirect](https://techdirect.dell.com/)
2. **Request Access**: Apply for API access through your account
3. **Get Credentials**: You'll receive:
   - **API Key**: Your unique identifier
   - **API Secret**: Required for OAuth 2.0 (mandatory since Dec 2019)
4. **Configure**: Enter both in WarrantyDog's API configuration

**Lenovo API Setup:**
1. **Register**: Create account at [Lenovo Support API Portal](https://supportapi.lenovo.com/)
2. **Request Access**: Apply for API access
3. **Get Client ID**: You'll receive a Client ID for authentication
4. **Configure**: Enter Client ID in WarrantyDog's API configuration

### 🔒 **Authentication Flow**
```
WarrantyDog Frontend → Express Backend → Vendor OAuth → API Token → Warranty Data
```

**Why Backend Proxy?**
- ✅ **Eliminates CORS issues** that block browser API calls
- ✅ **Secures API credentials** (never exposed to frontend)
- ✅ **Handles OAuth flows** automatically
- ✅ **Implements rate limiting** to prevent quota exhaustion
- ✅ **Caches responses** to improve performance

---

## 🏗️ **Technical Architecture**

### 📁 **Project Structure**
```
WarrantyDog/
├── 🌐 Frontend
│   ├── index.html              # Main application interface
│   ├── app.js                  # Core WarrantyChecker logic
│   ├── vendorApis.js           # API client implementations
│   ├── style.css               # Responsive UI styling
│   └── lib/papaparse.min.js    # CSV parsing library
│
├── 🖥️ Backend
│   ├── server.js               # Express API proxy server
│   ├── database/               # SQLite database services
│   │   └── DatabaseService.js  # Session & cache management
│   └── data/                   # SQLite database files
│
├── 🐳 Docker
│   ├── Dockerfile              # Container definition
│   ├── docker-compose.yml      # Container orchestration
│   └── docker-entrypoint.sh    # Container startup script
│
├── 🛠️ Development
│   ├── package.json            # Dependencies & scripts
│   └── examples/               # Sample CSV files
│
└── 📚 Documentation
    ├── README.md               # This file
    ├── examples/               # Sample CSV files
    └── docs/                   # Additional documentation
```

### 🔄 **Data Flow**
1. **CSV Upload** → Frontend parses with PapaParse
2. **Device Processing** → Backend API calls with OAuth
3. **Warranty Lookup** → Vendor APIs (Dell, Lenovo)
4. **Data Storage** → SQLite database for caching
5. **Results Export** → CSV download with warranty data

### 🛡️ **Security Features**
- ✅ **No client-side API keys** - all credentials secured in backend
- ✅ **OAuth 2.0 implementation** - proper vendor authentication
- ✅ **CORS protection** - backend proxy eliminates browser restrictions
- ✅ **Rate limiting** - prevents API quota exhaustion
- ✅ **Input validation** - sanitized CSV processing
- ✅ **Modern dependencies** - all security vulnerabilities fixed

---

## 🧪 **Testing & Validation**

### 🔍 **Quick Test**
1. **Start Application**: `docker-compose up -d`
2. **Open Browser**: http://localhost:3001
3. **Health Check**: http://localhost:3001/api/health should return `{"status":"ok"}`
4. **Upload Sample**: Use `examples/sample-devices.csv`
5. **Configure APIs**: Add your vendor credentials
6. **Process Devices**: Click "🔍 Check Warranties"
7. **Export Results**: Verify CSV export works

### 📊 **Sample Data Files**
- `examples/sample-devices.csv` - Mixed vendor test data
- `examples/test-dell.csv` - Dell-specific devices
- `examples/test-lenovo.csv` - Lenovo-specific devices

### 🔧 **Development Testing**
```bash
# Run code quality checks
npm run lint          # ESLint code analysis
npm run format        # Prettier code formatting
npm run validate      # Run both lint + format

# Test different environments
npm run dev           # Frontend development server
npm run server        # Backend production server
npm run dev-server    # Backend development server
```

---

## 🚀 **Deployment Options**

### 🐳 **Docker Deployment (Recommended)**

**Production deployment with Docker:**
```bash
# Clone repository
git clone https://github.com/cafasdon/WarrantyDog.git
cd WarrantyDog

# Deploy the application
docker-compose up --build -d
```

**Benefits:**
- ✅ **Consistent environment** across all platforms
- ✅ **No dependency conflicts** - everything containerized
- ✅ **Easy scaling** - Docker orchestration ready
- ✅ **Automatic restarts** - container health monitoring
- ✅ **Data persistence** - SQLite database in Docker volumes

### 🌐 **Traditional Server Deployment**

**For VPS/dedicated servers:**
```bash
# Install Node.js 16+ and npm
# Clone and setup
git clone https://github.com/cafasdon/WarrantyDog.git
cd WarrantyDog
npm install --production

# Start with process manager
npm install -g pm2
pm2 start server.js --name warrantydog
pm2 startup
pm2 save

# Configure reverse proxy (nginx/apache)
# Point to http://localhost:3001
```

### ☁️ **Cloud Deployment**

**Platform-specific guides:**
- **AWS**: Use ECS with Docker image
- **Google Cloud**: Deploy to Cloud Run
- **Azure**: Use Container Instances
- **DigitalOcean**: App Platform with Docker
- **Heroku**: Use container deployment

---

## 🛠️ **Troubleshooting**

### 🐳 **Docker Issues**

**Container won't start:**
```bash
# Check Docker is running
docker info

# Clean up and restart
docker-compose down
docker-compose up --build -d

# Check logs
docker-compose logs -f
```

**Port conflicts:**
```bash
# Check what's using port 3001
netstat -tulpn | grep 3001

# Stop conflicting services or change port in docker-compose.yml
```

**Permission issues (Linux/Mac):**
```bash
sudo chown -R $USER:$USER .
chmod +x start-warrantydog.sh
```

### 🔑 **API Issues**

**Dell API authentication fails:**
1. Verify you have both API Key AND API Secret
2. Check credentials at [Dell TechDirect Portal](https://techdirect.dell.com/portal/AboutAPIs.aspx)
3. Test API connection in WarrantyDog interface
4. Check browser console for detailed error messages

**Lenovo API issues:**
1. Verify Client ID is correct
2. Check rate limits haven't been exceeded
3. Ensure serial numbers are valid Lenovo format

**CORS errors:**
- ✅ **Should not occur** - backend proxy handles all API calls
- If you see CORS errors, ensure backend server is running on port 3001

### 🔧 **Development Issues**

**npm install fails:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Vite dev server issues:**
```bash
# Check port 8080 is available
npm run dev -- --port 8081

# Clear Vite cache
rm -rf node_modules/.vite
```

### 📊 **Data Issues**

**CSV parsing fails:**
- Ensure CSV has required columns: `vendor`, `serial`
- Check for special characters or encoding issues
- Verify CSV is properly formatted (commas, quotes)

**No warranty data returned:**
- Verify API credentials are configured
- Check device serial numbers are valid
- Ensure vendor names match supported vendors (Dell, Lenovo)
- Check API rate limits haven't been exceeded

---

## 🤝 **Contributing**

We welcome contributions! Here's how to get started:

### 🔧 **Development Setup**
```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR-USERNAME/WarrantyDog.git
cd WarrantyDog

# Create a feature branch
git checkout -b feature/your-feature-name

# Start development environment
docker-compose up -d
# OR
npm install && npm run dev-server
```

### 📝 **Making Changes**
1. **Code Style**: Run `npm run validate` before committing
2. **Testing**: Test your changes thoroughly
3. **Documentation**: Update README if needed
4. **Commit Messages**: Use clear, descriptive commit messages

### 🚀 **Submitting Changes**
```bash
# Commit your changes
git add .
git commit -m "Add: your feature description"

# Push to your fork
git push origin feature/your-feature-name

# Create a Pull Request on GitHub
```

---

## 📚 **Additional Resources**

### 🔗 **Useful Links**
- **Dell API Documentation**: [TechDirect API Portal](https://techdirect.dell.com/portal/AboutAPIs.aspx)
- **Lenovo API Documentation**: [Support API Portal](https://supportapi.lenovo.com/documentation/)
- **Docker Documentation**: [Docker Docs](https://docs.docker.com/)
- **Node.js Documentation**: [Node.js Docs](https://nodejs.org/docs/)

### 📖 **Learning Resources**
- **CSV Processing**: [PapaParse Documentation](https://www.papaparse.com/docs)
- **Express.js**: [Express Guide](https://expressjs.com/en/guide/)
- **SQLite**: [SQLite Documentation](https://sqlite.org/docs.html)
- **Vite**: [Vite Guide](https://vitejs.dev/guide/)

---

## 📄 **License**

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### 🏷️ **Version Information**
- **Current Version**: 2.0.0
- **Last Updated**: August 2025
- **Node.js**: 16+ required
- **Docker**: 20+ recommended

---

## 🎯 **Project Status**

✅ **Production Ready** - Fully functional warranty checking system
🔒 **Security Hardened** - All vulnerabilities fixed, modern dependencies
🐳 **Docker Optimized** - One-command deployment anywhere
🚀 **Modern Stack** - Vite, Express, SQLite, OAuth 2.0
📊 **Enterprise Ready** - Session management, caching, rate limiting

---

**Made with ❤️ for IT professionals who need warranty information fast.**

**Powered by Docker 🐳 | Secured with OAuth 2.0 🔒 | Built with Modern JavaScript ⚡**







