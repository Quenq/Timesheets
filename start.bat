@echo off
title Timesheet Manager
color 0A

echo.
echo  ==========================================
echo   TIMESHEET MANAGER - Starting...
echo  ==========================================
echo.

cd /d "%~dp0"

echo  [1/2] Starting Backend (port 5000)...
start "Backend - Timesheet API" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 4 /nobreak >nul

echo  [2/2] Starting Frontend (port 3000)...
start "Frontend - Timesheet App" cmd /k "cd /d "%~dp0frontend" && npm start"

timeout /t 5 /nobreak >nul

echo.
echo  ==========================================
echo   App running at: http://localhost:3000
echo   Admin:      admin@example.com
echo   Password:   password123
echo  ==========================================
echo.
echo  Both servers are running in separate windows.
echo  Close those windows to stop the servers.
echo.
pause
