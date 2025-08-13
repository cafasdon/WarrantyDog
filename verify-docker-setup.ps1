# WarrantyDog Docker Setup Verification Script
# Verifies that Docker deployment is working correctly

Write-Host "🧪 WarrantyDog Docker Setup Verification" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Function to test application health
function Test-ApplicationHealth {
    param([int]$MaxAttempts = 30)
    
    Write-Host "⏳ Testing application health..." -ForegroundColor Cyan
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Application is responding!" -ForegroundColor Green
                return $true
            }
        } catch {
            Write-Host "   Attempt $i/$MaxAttempts..." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
    
    Write-Host "❌ Application failed to respond after $MaxAttempts seconds" -ForegroundColor Red
    return $false
}

# Check if Docker is installed and running
Write-Host ""
Write-Host "🔍 Checking Docker installation..." -ForegroundColor Cyan

try {
    $null = Get-Command docker -ErrorAction Stop
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    Write-Host "   Download from: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Yellow
    exit 1
}

try {
    $null = docker info 2>$null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if WarrantyDog is currently running
Write-Host ""
Write-Host "🔍 Checking current WarrantyDog status..." -ForegroundColor Cyan

$runningContainers = docker ps --filter "ancestor=warrantydog" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null
if ($runningContainers -and $runningContainers.Length -gt 1) {
    Write-Host "✅ WarrantyDog containers found:" -ForegroundColor Green
    Write-Host $runningContainers -ForegroundColor White
    
    if (Test-ApplicationHealth -MaxAttempts 5) {
        Write-Host "✅ Application is working correctly!" -ForegroundColor Green
        Write-Host "🌐 Access your application at: http://localhost:3001" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️  Container is running but application is not responding" -ForegroundColor Yellow
        Write-Host "📋 Try checking logs with: docker-compose logs" -ForegroundColor Cyan
    }
} else {
    Write-Host "ℹ️  No WarrantyDog containers currently running" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🚀 To start WarrantyDog, run:" -ForegroundColor Cyan
    Write-Host "   docker-compose up -d" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Or use the startup script:" -ForegroundColor Cyan
    Write-Host "   .\start-warrantydog.bat" -ForegroundColor White
}

# Check Docker Compose
Write-Host ""
Write-Host "🔍 Checking Docker Compose..." -ForegroundColor Cyan

try {
    $null = docker-compose --version 2>$null
    Write-Host "✅ Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Docker Compose not found, but Docker should include it" -ForegroundColor Yellow
}

# Check if docker-compose.yml exists
if (Test-Path "docker-compose.yml") {
    Write-Host "✅ docker-compose.yml found" -ForegroundColor Green
} else {
    Write-Host "❌ docker-compose.yml not found in current directory" -ForegroundColor Red
    Write-Host "   Make sure you're in the WarrantyDog project directory" -ForegroundColor Yellow
}

# Check volumes
Write-Host ""
Write-Host "🔍 Checking Docker volumes..." -ForegroundColor Cyan

$volumes = docker volume ls --filter "name=warrantydog" --format "{{.Name}}" 2>$null
if ($volumes) {
    Write-Host "✅ WarrantyDog volumes found:" -ForegroundColor Green
    foreach ($volume in $volumes) {
        Write-Host "   - $volume" -ForegroundColor White
    }
} else {
    Write-Host "ℹ️  No WarrantyDog volumes found (will be created on first run)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Summary:" -ForegroundColor Green
Write-Host "============" -ForegroundColor Green
Write-Host "✅ Docker setup verification complete" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Quick commands:" -ForegroundColor Cyan
Write-Host "   Start:  docker-compose up -d" -ForegroundColor White
Write-Host "   Stop:   docker-compose down" -ForegroundColor White
Write-Host "   Logs:   docker-compose logs -f" -ForegroundColor White
Write-Host "   Status: docker ps" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Application URL: http://localhost:3001" -ForegroundColor Yellow
