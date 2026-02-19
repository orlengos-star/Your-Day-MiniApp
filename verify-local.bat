@echo off
title 🌿 Emotional Journal - Local Verification
echo ----------------------------------------
echo 🌿 Emotional Journal - Local Verification
echo ----------------------------------------

:: 1. Install dependencies
echo.
echo 📦 Step 1: Installing dependencies...
call npm install
cd frontend
call npm install
cd ..

:: 2. Build Frontend
echo.
echo 🏗️ Step 2: Building frontend...
call npm run build

:: 3. Start Backend in Dev Mode
echo.
echo 🚀 Step 3: Starting server in [DEVELOPMENT] mode...
echo Note: In dev mode, the app uses a mock Telegram user for testing.
set NODE_ENV=development
call npm start

pause
