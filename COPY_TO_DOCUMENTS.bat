@echo off
REM Copiar timesheet-tracker a Documents

echo.
echo ========================================
echo Copying Timesheet Tracker to Documents
echo ========================================
echo.

set SOURCE="%~dp0"
set DEST="C:\Users\juanb\Documents\Claude\Code\timesheet-tracker"

echo Source: %SOURCE%
echo Destination: %DEST%
echo.

REM Crear carpeta de destino
mkdir %DEST% 2>nul

REM Copiar archivos
echo Copying files...
xcopy "%SOURCE%*" %DEST% /E /I /Y /Q

if %errorlevel% equ 0 (
    echo.
    echo ✓ Files copied successfully!
    echo.
    echo Next steps:
    echo 1. Open two terminals
    echo 2. Terminal 1: cd %DEST%\backend && npm install && npm run dev
    echo 3. Terminal 2: cd %DEST%\frontend && npm install && npm start
    echo 4. Open http://localhost:3000
    echo.
) else (
    echo.
    echo ERROR: Copy failed!
    echo.
)

pause
