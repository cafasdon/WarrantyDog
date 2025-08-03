
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
- ✅ **Enterprise Security**: Rate limiting, security headers, structured logging
- ✅ **Operational Monitoring**: Real-time metrics and performance tracking
- ✅ **Smart Processing**: Skips unconfigured vendors to save API quotas
- ✅ **Modern Development**: Vite dev server, secure dependencies
- ✅ **Docker Ready**: One-command deployment anywhere
- ✅ **Data Persistence**: SQLite database with Docker volume persistence
- ✅ **Professional UX**: Real-time updates, error handling, export functionality

### 🏗️ **Architecture**
- **Frontend**: Modern JavaScript with Vite development server
- **Backend**: Node.js/Express API proxy with OAuth 2.0 token management
- **Database**: SQLite for session persistence and caching
- **Deployment**: Docker containerization for consistent environments
- **Security**: Fixed all high/medium vulnerabilities, modern dependency stack

---

## 🚀 **Quick Start Guide**

> **🔒 Clean Database Startup**: WarrantyDog starts with a completely empty database. No pre-existing warranty data or session information is included. The application automatically creates and initializes the database schema on first startup.

> **💾 Data Persistence**: All warranty data, API responses, and session information are stored in a persistent SQLite database using Docker volumes. Your data survives container restarts, updates, and system reboots.

### 📋 **Prerequisites**
- **Docker Desktop** installed and running ([Download here](https://www.docker.com/products/docker-desktop/))
- **Git** installed ([Download here](https://git-scm.com/downloads))

### ⚡ **One-Liner Installation**

**Linux/macOS/WSL:**
```bash
curl -sSL https://raw.githubusercontent.com/cafasdon/WarrantyDog/main/install.sh | bash
```

**Windows PowerShell:**
```powershell
iwr -useb https://raw.githubusercontent.com/cafasdon/WarrantyDog/main/install.ps1 | iex
```

**That's it!** The application will be automatically cloned, built, and started at **http://localhost:3001**

> **🚀 Zero-Configuration**: One command does everything - clones repo, builds container, starts application, and verifies it's running!

### 🎯 **Manual Installation (Alternative)**

**If you prefer to run the steps manually:**
```bash
git clone https://github.com/cafasdon/WarrantyDog.git
cd WarrantyDog

# Option 1: Using Docker Compose (Recommended - includes persistent storage)
docker-compose up -d

# Option 2: Using startup scripts with persistent storage
./start-warrantydog.sh    # Linux/macOS
start-warrantydog.bat     # Windows

# Option 3: Manual Docker run with persistent volumes
docker build -t warrantydog .
docker run -d -p 3001:3001 -v warrantydog-data:/app/data -v warrantydog-logs:/app/logs --name warrantydog warrantydog
```

### 🐳 **Docker Commands**

```bash
# Build the image
docker build -t warrantydog .

# Run the container
docker run -d -p 3001:3001 --name warrantydog warrantydog

# Check status
docker ps

# View logs
docker logs warrantydog -f

# Stop when done
docker stop warrantydog && docker rm warrantydog
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
│   └── Dockerfile              # Self-contained container definition
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
- ✅ **Express Rate Limiting** - 100 requests per 15 minutes per IP on API endpoints
- ✅ **Security Headers** - Helmet.js with CSP, HSTS, and CORS protection
- ✅ **Input validation** - sanitized CSV processing
- ✅ **Modern dependencies** - all security vulnerabilities fixed

### 📊 **Monitoring & Observability**
- ✅ **Structured Logging** - Winston with JSON formatting and file rotation
- ✅ **Metrics Endpoint** - Real-time operational data at `/api/metrics`
- ✅ **Performance Tracking** - Response time analysis and error monitoring
- ✅ **Security Events** - Rate limiting and security incident logging
- ✅ **System Monitoring** - Memory usage, uptime, and resource tracking

---

## 🧪 **Testing & Validation**

### 🔍 **Quick Test**
1. **Start Application**: `docker run -d -p 3001:3001 --name warrantydog warrantydog`
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

# Option 1: Docker Compose (Recommended)
docker-compose up -d

# Option 2: Manual Docker with persistent volumes
docker build -t warrantydog .
docker run -d -p 3001:3001 \
  -v warrantydog-data:/app/data \
  -v warrantydog-logs:/app/logs \
  --name warrantydog-container \
  warrantydog
```

**Benefits:**
- ✅ **Completely self-contained** - starts immediately when container launches
- ✅ **No external dependencies** - everything built into the container
- ✅ **Consistent environment** across all platforms
- ✅ **No dependency conflicts** - everything containerized
- ✅ **Easy scaling** - Docker orchestration ready
- ✅ **Data persistence** - SQLite database with Docker volumes (survives restarts)

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

## 💾 **Data Persistence & Database Management**

### 🗄️ **How Data Persistence Works**

WarrantyDog uses **Docker volumes** to ensure your warranty data, API responses, and session information persist across container restarts, updates, and system reboots.

**What gets stored:**
- ✅ **Raw API responses** - All vendor API responses for reprocessing
- ✅ **Warranty data** - Processed warranty information and status
- ✅ **Session history** - Processing sessions and progress tracking
- ✅ **Cache data** - Optimized lookups for faster subsequent runs

### 📊 **Database Commands**

**Check database contents:**
```bash
# View database statistics and sample data
docker exec warrantydog-container node check-db.js

# Detailed database debugging
docker exec warrantydog-container node debug-db.js
```

**Backup your data:**
```bash
# Create backup of database volume
docker run --rm -v warrantydog-data:/data -v $(pwd):/backup alpine tar czf /backup/warrantydog-backup.tar.gz -C /data .

# Restore from backup
docker run --rm -v warrantydog-data:/data -v $(pwd):/backup alpine tar xzf /backup/warrantydog-backup.tar.gz -C /data
```

**Reset database (clean start):**
```bash
# Stop container and remove volume
docker-compose down
docker volume rm warrantydog-data

# Restart with fresh database
docker-compose up -d
```

### 🔄 **Data Migration**

When you reload the same CSV file, WarrantyDog automatically:
1. **Detects previously processed devices** from the database
2. **Populates the live display** with cached warranty data
3. **Shows processing status** for each device
4. **Skips already processed devices** to save API calls

---

## 🛠️ **Troubleshooting**

### 🐳 **Docker Issues**

**Container won't start:**
```bash
# Check Docker is running
docker info

# Clean up and restart
docker stop warrantydog && docker rm warrantydog
docker build --no-cache -t warrantydog .
docker run -d -p 3001:3001 --name warrantydog warrantydog

# Check logs
docker logs warrantydog -f
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
docker build -t warrantydog . && docker run -d -p 3001:3001 --name warrantydog warrantydog
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

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

### 🔒 **Attribution Requirements**
Under the Apache License 2.0, any use of this software requires:
- **Prominent attribution** to the original author (Rodrigo Quintian)
- **Inclusion of the LICENSE file** in any distribution
- **Documentation of changes** made to the original code
- **Preservation of copyright notices** in derivative works

This ensures proper credit while still allowing commercial and private use.

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

---

## ⚠️ **Disclaimer & Development Notes**

### 🤖 **AI-Assisted Development**
This program was developed with significant assistance from **[Augment Code](https://augmentcode.com)**, an AI-powered coding assistant. The entire codebase was created through collaborative AI programming sessions, leveraging modern AI tools to accelerate development and ensure best practices.

### 🎓 **Learning Project**
**This is my first program built from scratch**, and as such, it likely contains flaws, inefficiencies, or areas for improvement. While the application is functional and has been tested, please be aware that:

- 🔍 **Code quality may vary** - Some sections might not follow optimal patterns
- 🐛 **Bugs may exist** - Thorough testing has been done, but edge cases may remain
- 🔧 **Architecture decisions** - Some choices were made for learning purposes rather than enterprise optimization
- 📚 **Documentation gaps** - Some areas might need better explanation or examples

### 🤝 **Contributions Welcome**
I **warmly welcome contributions** from the community! However, please understand that:

- ⏰ **Review time** - I will need time to carefully review all contributions to understand the changes
- 🎯 **Learning focus** - I want to understand every change to continue learning
- 🔄 **Iterative improvement** - This project will evolve gradually during my off-time
- 💬 **Discussion encouraged** - Feel free to open issues for questions or suggestions

### 🚧 **Work in Progress**
This project is **actively evolving** and will continue to improve as I:
- 📖 Learn more about software development best practices
- 🔧 Refactor and optimize existing code
- ✨ Add new features and vendor support
- 🛡️ Enhance security and error handling
- 📝 Improve documentation and examples

### 🙏 **Acknowledgments**
Special thanks to:
- **[Augment Code](https://augmentcode.com)** for providing the AI assistance that made this project possible
- **The open-source community** for the excellent libraries and tools used in this project
- **Dell and Lenovo** for providing public APIs that enable warranty checking functionality

---

*Built with curiosity, powered by AI, and improved through community collaboration.* 🚀







