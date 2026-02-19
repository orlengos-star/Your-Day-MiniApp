# verify-local.ps1
# This script helps you quickly set up and run the app locally for testing.

Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "🌿 Emotional Journal — Local Verification" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

# 1. Install dependencies
Write-Host "`n📦 Step 1: Installing dependencies..." -ForegroundColor Yellow
npm install
cd frontend
npm install
cd ..

# 2. Build Frontend
Write-Host "`n🏗️ Step 2: Building frontend..." -ForegroundColor Yellow
npm run build

# 3. Start Backend in Dev Mode
Write-Host "`n🚀 Step 3: Starting server in [DEVELOPMENT] mode..." -ForegroundColor Green
Write-Host "Note: In dev mode, the app uses a mock Telegram user for testing." -ForegroundColor Gray
$env:NODE_ENV = "development"
npm start
