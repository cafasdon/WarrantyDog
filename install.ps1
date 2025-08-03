# WarrantyDog One-Liner Installer for Windows PowerShell
# Clones, builds, and starts WarrantyDog in one command

Write-Host "🐕 WarrantyDog One-Liner Installer" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

# Check if Docker is installed and running
try {
    $null = Get-Command docker -ErrorAction Stop
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first:" -ForegroundColor Red
    Write-Host "   https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Yellow
    exit 1
}

try {
    $null = docker info 2>$null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if port 3001 is available and stop existing containers
$existingContainer = docker ps -q --filter "name=warrantydog" 2>$null
if ($existingContainer) {
    Write-Host "⚠️  Stopping existing WarrantyDog container..." -ForegroundColor Yellow
    docker stop warrantydog 2>$null | Out-Null
    docker rm warrantydog 2>$null | Out-Null
}

# Create temporary directory
$tempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
Set-Location $tempDir

Write-Host "📥 Cloning WarrantyDog repository..." -ForegroundColor Cyan
git clone https://github.com/cafasdon/WarrantyDog.git
Set-Location WarrantyDog

Write-Host "🔨 Building Docker container..." -ForegroundColor Cyan
docker build -t warrantydog .

Write-Host "🚀 Starting WarrantyDog application..." -ForegroundColor Cyan
docker run -d -p 3001:3001 -v warrantydog-data:/app/data -v warrantydog-logs:/app/logs --name warrantydog warrantydog | Out-Null

# Wait for application to be ready
Write-Host "⏳ Waiting for application to start..." -ForegroundColor Cyan
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ WarrantyDog is ready!" -ForegroundColor Green
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $ready) {
    Write-Host "❌ Application failed to start within 30 seconds" -ForegroundColor Red
    exit 1
}

# Cleanup
Set-Location \
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "🎉 WarrantyDog is now running!" -ForegroundColor Green
Write-Host "🌐 Open your browser to: http://localhost:3001" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Useful commands:" -ForegroundColor Cyan
Write-Host "   Stop:    docker stop warrantydog" -ForegroundColor White
Write-Host "   Start:   docker start warrantydog" -ForegroundColor White
Write-Host "   Remove:  docker stop warrantydog; docker rm warrantydog" -ForegroundColor White
Write-Host "   Logs:    docker logs warrantydog" -ForegroundColor White
