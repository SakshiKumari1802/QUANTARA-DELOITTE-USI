@echo off
REM Launch script for B2B Dashboard - Opens backend and frontend in separate terminals

echo Starting B2B Dashboard...
echo.

REM Get the directory where this batch file is located
set SCRIPT_DIR=%~dp0

REM Start Backend Server in a new terminal window
echo Starting Backend Server...
start "B2B Dashboard - Backend" cmd /k "cd /d "%SCRIPT_DIR%backend" && npm run server"

REM Wait a moment for the backend to start
timeout /t 2 /nobreak >nul

REM Start Frontend in a new terminal window
echo Starting Frontend...
start "B2B Dashboard - Frontend" cmd /k "cd /d "%SCRIPT_DIR%B2B Dashboard Design" && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173 (or check the terminal for the actual port)
echo.
echo Press any key to exit this window (servers will continue running)...
pause >nul


