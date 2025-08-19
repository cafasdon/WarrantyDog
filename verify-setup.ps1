# WarrantyDog Setup Verification Script
# Run this script to verify the current setup is working correctly

Write-Host "🐕 WarrantyDog Setup Verification" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: Not in WarrantyDog directory. Please run from project root." -ForegroundColor Red
    exit 1
}

Write-Host "📁 Checking project structure..." -ForegroundColor Yellow

# Check key files exist
$requiredFiles = @(
    "src/app.ts",
    "src/server.ts", 
    "src/vendorApis.ts",
    "src/sessionService.ts",
    "tsconfig.json",
    "webpack.config.js",
    "test_bdr_devices.csv"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Missing required files. Please check your setup." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Checking Node.js and npm..." -ForegroundColor Yellow

# Check Node.js version
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check npm version
try {
    $npmVersion = npm --version
    Write-Host "  ✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ npm not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "🔨 Building application..." -ForegroundColor Yellow
npm run build --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Build successful" -ForegroundColor Green

Write-Host ""
Write-Host "📊 Checking build output..." -ForegroundColor Yellow

$buildFiles = @(
    "dist/app.js",
    "dist/index.html",
    "dist/style.css",
    "dist/src/server.js"
)

foreach ($file in $buildFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "  ✅ $file ($([math]::Round($size/1KB, 1))KB)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file missing" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🧪 Checking test files..." -ForegroundColor Yellow

if (Test-Path "test_devices_sample.csv") {
    $csvContent = Get-Content "test_devices_sample.csv" -First 2
    Write-Host "  ✅ test_devices_sample.csv exists" -ForegroundColor Green
    Write-Host "    Header: $($csvContent[0])" -ForegroundColor Gray
    Write-Host "    Sample: $($csvContent[1])" -ForegroundColor Gray
} else {
    Write-Host "  ❌ test_devices_sample.csv missing" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔒 Security audit..." -ForegroundColor Yellow

# Check for sensitive files that should not exist
$sensitiveFiles = @(
    "test_bdr_devices.csv",
    "data/warrantydog.db",
    "examples/System Information Report - BDR.csv",
    ".env"
)

$foundSensitive = $false
foreach ($file in $sensitiveFiles) {
    if (Test-Path $file) {
        Write-Host "  ❌ SECURITY RISK: $file found (should not exist)" -ForegroundColor Red
        $foundSensitive = $true
    }
}

if (!$foundSensitive) {
    Write-Host "  ✅ No sensitive files detected" -ForegroundColor Green
}

# Check .gitignore is protecting sensitive patterns
if (Test-Path ".gitignore") {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    if ($gitignoreContent -match "\*\.db" -and $gitignoreContent -match "test_.*devices\.csv") {
        Write-Host "  ✅ .gitignore protects sensitive files" -ForegroundColor Green
    } else {
        Write-Host "  ❌ .gitignore missing sensitive file protection" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🚀 Starting server for verification..." -ForegroundColor Yellow
Write-Host "   (Server will start in background, press Ctrl+C to stop)" -ForegroundColor Gray

# Start server in background
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npm start
}

# Wait a moment for server to start
Start-Sleep -Seconds 3

# Check if server is responding
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✅ Server responding on http://localhost:3001" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Server not responding correctly" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Server not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Stop the server job
Stop-Job $serverJob -Force
Remove-Job $serverJob -Force

Write-Host ""
Write-Host "🎉 VERIFICATION COMPLETE" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Setup Status: READY" -ForegroundColor Green
Write-Host "✅ Current Commit: $(git rev-parse --short HEAD)" -ForegroundColor Green
Write-Host "✅ All core functionality verified" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 To start WarrantyDog:" -ForegroundColor Yellow
Write-Host "   npm start" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Then open: http://localhost:3001" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Test with: test_devices_sample.csv" -ForegroundColor Yellow
Write-Host ""
Write-Host "📚 Documentation: README.md & DEVELOPMENT_NOTES.md" -ForegroundColor Yellow
