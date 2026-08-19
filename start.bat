@echo off
echo ============================================
echo   AI Companion - Quick Start
echo ============================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Install it from https://nodejs.org
  pause
  exit /b 1
)

REM Check Ollama
where ollama >nul 2>nul
if %errorlevel% neq 0 (
  echo [WARN] Ollama not found in PATH. Make sure it's running on http://127.0.0.1:11434
  echo        Install from https://ollama.com
)

REM Install deps if needed
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

REM Create .env from example if missing
if not exist ".env" (
  copy .env.example .env >nul
  echo Created .env from .env.example
)

REM Create data dir
if not exist "data" mkdir data

echo.
echo Starting server on http://localhost:3000
echo.
node server.js
pause
