@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm are required to preview Class Break.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Building Class Break...
call npm run build
if errorlevel 1 (
  pause
  exit /b 1
)

echo Opening http://127.0.0.1:8765/
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process 'http://127.0.0.1:8765/'"
call npm run preview -- --host 127.0.0.1 --port 8765 --strictPort

if errorlevel 1 (
  echo Preview could not start. Another program may already be using port 8765.
  pause
)
