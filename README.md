# WarrantyDog 🐕

**A modern, enterprise-grade warranty checker that fetches warranty information from multiple hardware vendors using their APIs.**

✅ **Production Ready** | 🐳 **Docker Containerized** | 🔒 **Secure OAuth 2.0** | 🚀 **Modern Stack** | 💾 **SQLite Database**

---

## 🎯 **What is WarrantyDog?**

WarrantyDog is a comprehensive warranty management solution designed for IT professionals and system administrators who need to efficiently track hardware warranty status across multiple vendors. The application provides:

- **📊 CSV File Processing**: Upload device lists and get warranty information for hundreds of devices
- **🔌 Multi-Vendor API Integration**: Currently supports Dell and Lenovo with HP coming soon
- **⚡ Real-time Progress Tracking**: Live updates with cancellation support and retry functionality
- **💾 Persistent Session Management**: SQLite database ensures data survives container restarts
- **📤 Complete Results Export**: Export warranty data to CSV with all available information
- **🐳 Docker Deployment**: One-command deployment with volume persistence

### ✨ **Key Features**

#### 🔐 **Enterprise Security & Authentication**
- ✅ **Dell OAuth 2.0 Integration**: Secure API authentication with automatic token management
- ✅ **Lenovo API Support**: ClientID-based authentication for warranty lookups
- ✅ **Rate Limiting Protection**: Intelligent rate limiting with automatic retry scheduling
- ✅ **Security Headers**: Helmet.js integration with CSP and security best practices
- ✅ **Structured Logging**: Winston-based logging with security event tracking

#### 🚀 **Advanced Processing Capabilities**
- ✅ **Intelligent Concurrent Processing**: Optimized batch processing with adaptive rate limiting
- ✅ **Smart Duplicate Detection**: Cross-session caching prevents redundant API calls
- ✅ **Error Recovery**: Automatic retry logic with exponential backoff
- ✅ **Session Persistence**: Resume processing after interruptions or container restarts
- ✅ **Vendor Support Detection**: Automatically skips unsupported vendors to save API quotas

#### 💾 **Data Management & Persistence**
- ✅ **SQLite Database**: Comprehensive schema for sessions, devices, and API responses
- ✅ **Docker Volume Persistence**: Data survives container updates and restarts
- ✅ **API Response Caching**: Stores raw API responses for reprocessing and debugging
- ✅ **Processing History**: Complete audit trail of all warranty lookup attempts
- ✅ **Database Health Monitoring**: Built-in health checks and cleanup recommendations

#### 🎨 **Professional User Experience**
- ✅ **Modern Web Interface**: Responsive design with real-time progress indicators
- ✅ **Drag & Drop CSV Upload**: Intuitive file handling with validation
- ✅ **Live Statistics**: Real-time counters for processed, successful, failed, and skipped devices
- ✅ **Cancel & Resume**: Stop processing anytime and resume from where you left off
- ✅ **Export Functionality**: Download complete results with warranty details and status

### 🏗️ **Technical Architecture**

WarrantyDog follows a modern three-tier architecture optimized for enterprise deployment:

- **🌐 Frontend**: Vanilla JavaScript SPA with modern ES6+ modules and responsive CSS
- **🖥️ Backend**: Node.js/Express API proxy with OAuth 2.0 token management and rate limiting
- **💾 Database**: SQLite with comprehensive schema for session management and data persistence
- **🐳 Deployment**: Docker containerization with Alpine Linux for minimal footprint
- **🔒 Security**: Helmet.js security headers, rate limiting, and structured audit logging

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
- **Full Application**: http://localhost:3001 (production & development)
- **API Endpoints**: http://localhost:3001/api/*
- **Health Check**: http://localhost:3001/api/health
- **Metrics**: http://localhost:3001/api/metrics

### 🔧 **Development Commands**
```bash
npm start            # Start production server (port 3001)
npm run server       # Start backend API server (port 3001)
npm run dev-server   # Start backend with auto-restart (requires nodemon)
npm run dev          # Development info (static files served from backend)
npm run lint         # Code quality info (development tools not included)
npm run format       # Code formatting info (development tools not included)
npm run validate     # Validation info (development tools not included)
```

> **📝 Note**: This is a production-focused build. Development tools like ESLint and Prettier are not included to keep the container lightweight. For development, you can add these tools as needed.

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

## 📡 **API Documentation**

WarrantyDog provides a comprehensive REST API for integration with other systems and automation tools.

### 🔗 **Base URL**
```
http://localhost:3001/api
```

### 🏥 **Health & Status Endpoints**

#### Health Check
```http
GET /api/health
```
Returns server health status and database connectivity.

**Response:**
```json
{
  "status": "ok",
  "message": "WarrantyDog API proxy server is running",
  "timestamp": "2025-01-13T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "api": "operational",
    "proxy": "operational",
    "database": "ok"
  }
}
```

#### Readiness Check
```http
GET /api/ready
```
Returns whether the server is ready to accept requests.

#### Metrics
```http
GET /api/metrics
```
Returns operational metrics including request counts, response times, and vendor API statistics.

### 🔌 **Vendor API Proxy Endpoints**

#### Dell Warranty Lookup
```http
GET /api/dell/warranty/{serviceTag}
Headers:
  X-Dell-Api-Key: your-api-key
  X-Dell-Api-Secret: your-api-secret
```

**Example:**
```bash
curl -X GET "http://localhost:3001/api/dell/warranty/ABC1234" \
  -H "X-Dell-Api-Key: your-key" \
  -H "X-Dell-Api-Secret: your-secret"
```

#### Lenovo Warranty Lookup
```http
POST /api/lenovo/warranty
Headers:
  X-Lenovo-Client-Id: your-client-id
  Content-Type: application/x-www-form-urlencoded
Body:
  Serial=your-serial-number
```

**Example:**
```bash
curl -X POST "http://localhost:3001/api/lenovo/warranty" \
  -H "X-Lenovo-Client-Id: your-client-id" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Serial=LEN001"
```

### 💾 **Session Management Endpoints**

#### Get Active Sessions
```http
GET /api/sessions
```
Returns list of all active processing sessions.

#### Get Session Details
```http
GET /api/sessions/{sessionId}
```
Returns detailed session information including devices and progress.

#### Create New Session
```http
POST /api/sessions
Content-Type: application/json
```

**Request Body:**
```json
{
  "sessionId": "session_123",
  "fileName": "devices.csv",
  "devices": [
    {
      "vendor": "Dell",
      "serialNumber": "ABC1234",
      "model": "OptiPlex 7090",
      "location": "Office-Floor1"
    }
  ],
  "options": {
    "skipDuplicates": true,
    "maxAgeHours": 24
  }
}
```

#### Update Session Progress
```http
PUT /api/sessions/{sessionId}/progress
Content-Type: application/json
```

**Request Body:**
```json
{
  "processed": 10,
  "successful": 8,
  "failed": 1,
  "skipped": 1
}
```

### 🗄️ **Database & Cache Endpoints**

#### Get Cached Warranty Data
```http
POST /api/cached-warranty
Content-Type: application/json
```

**Request Body:**
```json
{
  "vendor": "dell",
  "serviceTag": "ABC1234",
  "maxAgeHours": 24
}
```

#### Get Database Statistics
```http
GET /api/database/stats
```
Returns comprehensive database statistics including session counts, device counts, and cache hit rates.

#### Get Failed Parsing Responses
```http
GET /api/failed-parsing?vendor=dell&limit=100
```
Returns API responses that failed to parse for reprocessing.

### 🔄 **Device Management Endpoints**

#### Get Device by Serial Number
```http
GET /api/sessions/{sessionId}/devices/{serialNumber}
```

#### Update Device State
```http
PUT /api/devices/{deviceId}/state
Content-Type: application/json
```

**Request Body:**
```json
{
  "processing_state": "success",
  "warranty_status": "Active",
  "warranty_end_date": "2025-12-31",
  "warranty_type": "ProSupport"
}
```

#### Get Retryable Devices
```http
GET /api/sessions/{sessionId}/retryable
```
Returns devices that failed processing but can be retried.

### 📊 **Bulk Operations**

#### Bulk Warranty Data Lookup
```http
POST /api/warranty-data/bulk
Content-Type: application/json
```

**Request Body:**
```json
{
  "devices": [
    {"vendor": "dell", "serviceTag": "ABC1234"},
    {"vendor": "lenovo", "serviceTag": "LEN001"}
  ]
}
```

### 🚨 **Error Responses**

All API endpoints return standardized error responses:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": "Additional error details",
  "timestamp": "2025-01-13T10:30:00.000Z"
}
```

**Common Error Codes:**
- `rate_limit_exceeded` - API rate limit reached
- `authentication_required` - Missing or invalid API credentials
- `invalid_request` - Malformed request data
- `vendor_api_error` - Upstream vendor API error
- `database_error` - Database operation failed

### 🔒 **Authentication & Rate Limiting**

- **Rate Limiting**: 100 requests per 15 minutes per IP address
- **Vendor APIs**: Require specific headers for authentication
- **CORS**: Enabled for browser-based applications
- **Security Headers**: Helmet.js protection enabled

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

**Development server issues:**
```bash
# Check port 3001 is available
lsof -i :3001

# Kill process using port 3001
kill -9 $(lsof -t -i:3001)
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

## 🤝 **Contributing**

We welcome contributions from the community! WarrantyDog is an open-source project that benefits from diverse perspectives and expertise.

### 🚀 **How to Contribute**

#### 🐛 **Reporting Bugs**
1. **Check existing issues** to avoid duplicates
2. **Use the bug report template** when creating new issues
3. **Include detailed information**:
   - Operating system and version
   - Docker version (if using containers)
   - Node.js version (if running locally)
   - Steps to reproduce the issue
   - Expected vs actual behavior
   - Screenshots or logs if applicable

#### ✨ **Suggesting Features**
1. **Check the roadmap** in GitHub Issues
2. **Open a feature request** with detailed description
3. **Explain the use case** and business value
4. **Consider implementation complexity** and maintenance impact

#### 🔧 **Code Contributions**

**Development Setup:**
```bash
# Fork the repository on GitHub
git clone https://github.com/your-username/WarrantyDog.git
cd WarrantyDog

# Install dependencies
npm install

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and test thoroughly
npm run server  # Test backend
# Open http://localhost:3001 and test frontend

# Commit with descriptive messages
git commit -m "feat: add HP warranty API integration"

# Push and create pull request
git push origin feature/your-feature-name
```

**Code Standards:**
- ✅ **ES6+ JavaScript** with modern syntax
- ✅ **Consistent formatting** (we recommend Prettier)
- ✅ **Descriptive variable names** and comments
- ✅ **Error handling** for all async operations
- ✅ **Security best practices** (no hardcoded secrets)

#### 📝 **Documentation Contributions**
- **README improvements** - clarify instructions, fix typos
- **Code comments** - explain complex logic
- **API documentation** - document new endpoints
- **Examples** - provide sample CSV files or use cases

### 🔍 **Development Guidelines**

#### 🧪 **Testing Requirements**
- **Manual testing** of all changes
- **Cross-browser compatibility** (Chrome, Firefox, Safari, Edge)
- **Docker deployment testing** to ensure containerization works
- **API endpoint testing** with various inputs and edge cases

#### 🔒 **Security Considerations**
- **Never commit API keys** or sensitive credentials
- **Validate all user inputs** to prevent injection attacks
- **Use parameterized queries** for database operations
- **Follow OWASP security guidelines**

#### 📦 **Dependency Management**
- **Minimize new dependencies** - justify each addition
- **Keep dependencies updated** - regularly check for security updates
- **Use exact versions** in package.json for reproducible builds
- **Document breaking changes** in dependency updates

### 🎯 **Priority Areas for Contribution**

#### 🔥 **High Priority**
- **HP API Integration** - Complete the HP warranty lookup functionality
- **Microsoft Surface Support** - Add Microsoft warranty API
- **ASUS/Acer Support** - Expand vendor coverage
- **Enhanced Error Recovery** - Improve retry logic and error handling

#### 📊 **Medium Priority**
- **Advanced Reporting** - Export formats (Excel, PDF)
- **Bulk Import Improvements** - Better CSV validation and error reporting
- **Performance Optimization** - Database query optimization
- **UI/UX Enhancements** - Mobile responsiveness, accessibility

#### 🔧 **Technical Debt**
- **Code Refactoring** - Improve modularity and maintainability
- **Test Coverage** - Add automated testing framework
- **Documentation** - Improve inline code documentation
- **Monitoring** - Enhanced logging and metrics

### 📋 **Pull Request Process**

1. **Fork the repository** and create a feature branch
2. **Make your changes** with clear, focused commits
3. **Test thoroughly** in both development and Docker environments
4. **Update documentation** if you're changing functionality
5. **Submit a pull request** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots for UI changes
   - Testing instructions

### 🏷️ **Commit Message Guidelines**

Use conventional commit format:
```
type(scope): description

feat(api): add HP warranty lookup endpoint
fix(ui): resolve CSV upload validation issue
docs(readme): update installation instructions
refactor(db): optimize session query performance
```

**Types:**
- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding tests
- `chore` - Maintenance tasks

### 🎖️ **Recognition**

Contributors will be recognized in:
- **GitHub Contributors** section
- **Release notes** for significant contributions
- **README acknowledgments** for major features

### 📞 **Getting Help**

- **GitHub Discussions** - Ask questions and share ideas
- **GitHub Issues** - Report bugs and request features
- **Code Review** - Get feedback on your contributions

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
- **Winston Logging**: [Winston Documentation](https://github.com/winstonjs/winston)

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
- **Current Version**: 1.0.0
- **Last Updated**: January 2025
- **Node.js**: 16+ required
- **Docker**: 20+ recommended

---

## 🎯 **Project Status**

✅ **Production Ready** - Fully functional warranty checking system
🔒 **Security Hardened** - All vulnerabilities fixed, modern dependencies
🐳 **Docker Optimized** - One-command deployment anywhere
🚀 **Modern Stack** - Node.js, Express, SQLite, OAuth 2.0
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








