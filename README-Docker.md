# 🐳 WarrantyDog Docker Deployment

Complete Docker containerization for WarrantyDog - run anywhere with zero dependencies!

## 🚀 Quick Start

### Option 1: One-Command Deployment
```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.simple.yml up --build
```

### Option 2: Using Convenience Scripts
```bash
# Linux/macOS
chmod +x scripts/*.sh
./scripts/docker-deploy.sh

# Windows
scripts\docker-run.bat
```

### Option 3: Manual Docker Commands
```bash
# Build the image
docker build -f Dockerfile.production -t warrantydog:latest .

# Run the container
docker run -d -p 3001:3001 --name warrantydog-app warrantydog:latest
```

## 📦 What's Included

### Self-Contained Application
- ✅ **Node.js Backend**: Express server with OAuth 2.0 support
- ✅ **Static File Serving**: Complete frontend served from container
- ✅ **Health Checks**: Built-in monitoring and readiness checks
- ✅ **Security**: Non-root user, minimal attack surface
- ✅ **Production Ready**: Optimized multi-stage build

### Container Features
- **Port**: 3001 (configurable)
- **Health Check**: `/api/health` endpoint
- **Readiness Check**: `/api/ready` endpoint
- **Logs**: Structured logging with timestamps
- **Restart Policy**: Automatic restart on failure

## 🛠️ Available Scripts

### Linux/macOS Scripts
```bash
./scripts/docker-build.sh    # Build production image
./scripts/docker-run.sh      # Run standalone container
./scripts/docker-deploy.sh   # Deploy with Docker Compose
./scripts/docker-stop.sh     # Stop all containers
```

### Windows Scripts
```batch
scripts\docker-run.bat       # Run container on Windows
```

## 🐳 Docker Compose Options

### Simple Deployment
```bash
docker-compose -f docker-compose.simple.yml up
```

### Production Deployment
```bash
docker-compose -f docker-compose.production.yml up
```

## 🔧 Configuration

### Environment Variables
```bash
NODE_ENV=production          # Environment mode
PORT=3001                   # Server port (default: 3001)
LOG_LEVEL=info              # Logging level
```

### Port Mapping
```bash
# Default: Host port 3001 → Container port 3001
docker run -p 3001:3001 warrantydog:latest

# Custom port: Host port 8080 → Container port 3001
docker run -p 8080:3001 warrantydog:latest
```

## 🏥 Health Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "ok",
  "message": "WarrantyDog API proxy server is running",
  "timestamp": "2025-07-22T15:30:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "api": "operational",
    "proxy": "operational"
  }
}
```

### Container Health Status
```bash
docker ps                    # Check container status
docker logs warrantydog-app  # View container logs
```

## 🚀 Deployment Scenarios

### Local Development
```bash
docker run -p 3001:3001 warrantydog:latest
# Access: http://localhost:3001
```

### Server Deployment
```bash
docker run -d \
  --name warrantydog \
  --restart unless-stopped \
  -p 80:3001 \
  warrantydog:latest
# Access: http://your-server-ip
```

### Behind Reverse Proxy
```bash
docker run -d \
  --name warrantydog \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  warrantydog:latest
# Configure nginx/apache to proxy to localhost:3001
```

## 🔒 Security Features

### Container Security
- ✅ **Non-root user**: Runs as `warrantydog` user (UID 1001)
- ✅ **Minimal base**: Alpine Linux for small attack surface
- ✅ **No unnecessary packages**: Production-only dependencies
- ✅ **Signal handling**: Proper shutdown with dumb-init

### Network Security
- ✅ **Isolated network**: Custom Docker network
- ✅ **Port control**: Only expose necessary ports
- ✅ **Health checks**: Monitor container health

## 📊 Management Commands

### View Logs
```bash
docker logs -f warrantydog-app                    # Follow logs
docker-compose logs -f                            # Compose logs
```

### Container Management
```bash
docker stop warrantydog-app                       # Stop container
docker start warrantydog-app                      # Start container
docker restart warrantydog-app                    # Restart container
docker rm warrantydog-app                         # Remove container
```

### Image Management
```bash
docker images warrantydog                         # List images
docker rmi warrantydog:latest                     # Remove image
```

## 🌐 Access Points

Once running, WarrantyDog is available at:
- **Main Application**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health
- **Readiness Check**: http://localhost:3001/api/ready
- **Dell API Proxy**: http://localhost:3001/api/dell/warranty/:serviceTag

## 🎯 Production Checklist

- [ ] Build production image: `./scripts/docker-build.sh`
- [ ] Test locally: `docker run -p 3001:3001 warrantydog:latest`
- [ ] Verify health check: `curl http://localhost:3001/api/health`
- [ ] Configure Dell API credentials in the application
- [ ] Set up reverse proxy (if needed)
- [ ] Configure monitoring and logging
- [ ] Set up backup strategy for container data

## 🆘 Troubleshooting

### Container Won't Start
```bash
docker logs warrantydog-app    # Check logs
docker ps -a                   # Check container status
```

### Port Already in Use
```bash
# Use different port
docker run -p 8080:3001 warrantydog:latest

# Or stop conflicting service
sudo lsof -i :3001
```

### Health Check Failing
```bash
# Check if server is responding
curl -v http://localhost:3001/api/health

# Check container logs
docker logs warrantydog-app
```

---

**🐕 WarrantyDog is now fully containerized and ready to run anywhere!**
