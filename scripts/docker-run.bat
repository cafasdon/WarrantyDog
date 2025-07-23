@echo off
REM WarrantyDog Docker Run Script for Windows
REM Runs the WarrantyDog container with proper configuration

set CONTAINER_NAME=warrantydog-app
set IMAGE_NAME=warrantydog:latest
set PORT=3001

echo 🐕 Starting WarrantyDog Container...

REM Stop existing container if running
docker ps -q -f name=%CONTAINER_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo ⏹️  Stopping existing container...
    docker stop %CONTAINER_NAME%
    docker rm %CONTAINER_NAME%
)

REM Run the container
echo 🚀 Starting new container...
docker run -d ^
    --name %CONTAINER_NAME% ^
    --restart unless-stopped ^
    -p %PORT%:3001 ^
    -e NODE_ENV=production ^
    %IMAGE_NAME%

echo ✅ Container started successfully!
echo 🌐 Application available at: http://localhost:%PORT%
echo 🔍 Health check: http://localhost:%PORT%/api/health

REM Show container status
echo.
echo 📊 Container Status:
docker ps -f name=%CONTAINER_NAME%

REM Show logs
echo.
echo 📝 Recent logs:
docker logs --tail 10 %CONTAINER_NAME%

pause
