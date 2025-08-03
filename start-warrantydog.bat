@echo off
REM WarrantyDog Startup Script for Windows
REM This script ensures proper Docker volume mounting for database persistence

echo 🐕 Starting WarrantyDog with persistent data storage...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)

REM Stop and remove existing container if it exists
echo 🧹 Cleaning up existing containers...
docker stop warrantydog-container >nul 2>&1
docker rm warrantydog-container >nul 2>&1

REM Build the latest image
echo 🔨 Building WarrantyDog Docker image...
docker build -t warrantydog .

if %errorlevel% neq 0 (
    echo ❌ Docker build failed. Please check the build output above.
    pause
    exit /b 1
)

REM Start with Docker Compose for proper volume management
if exist "docker-compose.yml" (
    echo 🚀 Starting WarrantyDog with Docker Compose (recommended)...
    docker-compose up -d
    
    if %errorlevel% equ 0 (
        echo ✅ WarrantyDog started successfully with persistent storage!
        echo 🌐 Access the application at: http://localhost:3001
        echo 💾 Database data will persist between container restarts
        echo 📊 Check status with: docker-compose logs -f
    ) else (
        echo ❌ Failed to start with Docker Compose, falling back to direct Docker run...
        REM Fallback to direct docker run
        docker run -d -p 3001:3001 -v warrantydog-data:/app/data -v warrantydog-logs:/app/logs --name warrantydog-container warrantydog
        
        if %errorlevel% equ 0 (
            echo ✅ WarrantyDog started successfully with persistent storage!
            echo 🌐 Access the application at: http://localhost:3001
            echo 💾 Database data will persist between container restarts
        ) else (
            echo ❌ Failed to start WarrantyDog container.
            pause
            exit /b 1
        )
    )
) else (
    echo 🚀 Starting WarrantyDog with direct Docker run...
    docker run -d -p 3001:3001 -v warrantydog-data:/app/data -v warrantydog-logs:/app/logs --name warrantydog-container warrantydog
    
    if %errorlevel% equ 0 (
        echo ✅ WarrantyDog started successfully with persistent storage!
        echo 🌐 Access the application at: http://localhost:3001
        echo 💾 Database data will persist between container restarts
    ) else (
        echo ❌ Failed to start WarrantyDog container.
        pause
        exit /b 1
    )
)

echo.
echo 📋 Useful commands:
echo   - View logs: docker logs warrantydog-container -f
echo   - Stop: docker stop warrantydog-container
echo   - Check database: docker exec warrantydog-container node check-db.js
echo   - Debug database: docker exec warrantydog-container node debug-db.js
echo.
pause
