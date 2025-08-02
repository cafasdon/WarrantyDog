@echo off
REM WarrantyDog Quick Start Script for Windows
REM Starts WarrantyDog with immediate web availability

echo 🐕 WarrantyDog Quick Start
echo ==========================

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

echo 🔧 Starting WarrantyDog application...

REM Stop any existing containers
echo 🛑 Stopping any existing WarrantyDog containers...
docker-compose -f docker-compose.simple.yml down >nul 2>&1

REM Build and start the application
echo 🏗️  Building and starting WarrantyDog...
docker-compose -f docker-compose.simple.yml up --build -d

REM Wait for the application to be ready
echo ⏳ Waiting for WarrantyDog to be ready...
set max_attempts=30
set attempt=1

:wait_loop
curl -s -f http://localhost:3001/api/health >nul 2>&1
if not errorlevel 1 (
    echo ✅ WarrantyDog is ready!
    goto ready
)

if %attempt% geq %max_attempts% (
    echo ❌ WarrantyDog failed to start within expected time
    echo 📋 Container logs:
    docker-compose logs --tail=20
    pause
    exit /b 1
)

echo 🔄 Attempt %attempt%/%max_attempts% - Waiting for application...
timeout /t 2 >nul
set /a attempt+=1
goto wait_loop

:ready
echo.
echo 🎉 WarrantyDog is now running!
echo 🌐 Web Interface: http://localhost:3001
echo 📊 Health Check: http://localhost:3001/api/health
echo 🔧 API Endpoints:
echo    - Dell API: http://localhost:3001/api/dell/warranty/:serviceTag
echo    - Lenovo API: http://localhost:3001/api/lenovo/warranty
echo.
echo 📋 Useful commands:
echo    - View logs: docker-compose logs -f
echo    - Stop application: docker-compose down
echo    - Restart application: docker-compose restart
echo.
echo 🚀 Ready to check warranties!
echo.
echo Press any key to open WarrantyDog in your browser...
pause >nul
start http://localhost:3001
