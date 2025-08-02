# WarrantyDog Quick Start Script for Windows PowerShell
# Starts WarrantyDog with immediate web availability

Write-Host "WarrantyDog Quick Start" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Docker is not running. Please start Docker first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Docker Compose is available
try {
    docker-compose --version | Out-Null
    Write-Host "Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting WarrantyDog application..." -ForegroundColor Yellow

# Stop any existing containers
Write-Host "Stopping any existing WarrantyDog containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.simple.yml down 2>$null

# Build and start the application
Write-Host "Building and starting WarrantyDog..." -ForegroundColor Yellow
docker-compose -f docker-compose.simple.yml up --build -d

# Wait for the application to be ready
Write-Host "Waiting for WarrantyDog to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 1

do {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            break
        }
    } catch {
        # Continue waiting
    }
    
    if ($attempt -ge $maxAttempts) {
        Write-Host "WarrantyDog failed to start within expected time" -ForegroundColor Red
        Write-Host "Container logs:" -ForegroundColor Red
        docker-compose -f docker-compose.simple.yml logs --tail=20
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host "Attempt $attempt/$maxAttempts - Waiting for application..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    $attempt++
} while ($true)

Write-Host ""
Write-Host "WarrantyDog is now running!" -ForegroundColor Green
Write-Host "Web Interface: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Health Check: http://localhost:3001/api/health" -ForegroundColor Cyan
Write-Host "API Endpoints:" -ForegroundColor Cyan
Write-Host "   - Dell API: http://localhost:3001/api/dell/warranty/:serviceTag" -ForegroundColor Cyan
Write-Host "   - Lenovo API: http://localhost:3001/api/lenovo/warranty" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "   - View logs: docker-compose -f docker-compose.simple.yml logs -f" -ForegroundColor Yellow
Write-Host "   - Stop application: docker-compose -f docker-compose.simple.yml down" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to open WarrantyDog in your browser..." -ForegroundColor Green
Read-Host
Start-Process "http://localhost:3001"
Write-Host ""
Write-Host "WarrantyDog is ready to use!" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
