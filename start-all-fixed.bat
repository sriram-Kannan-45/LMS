@echo off
title Starting LMS Backend + AI Service
color 0B

echo ==================================================
echo   LMS AI Quiz Feature - Server Startup
echo ==================================================
echo.

:: Check if node_modules exist
if not exist "%~dp0backend\node_modules" (
    echo [1/3] Installing backend dependencies...
    cd /d "%~dp0backend"
    call npm install
)

:: Start Python AI Service in new window
echo [1/3] Starting Python AI Service on port 8000...
start "AI Service" cmd /k "cd /d \"%~dp0ai-service\" && pip install -q -r requirements.txt && echo Starting AI Service... && python main.py"

:: Wait for AI service to start
timeout /t 3 /nobreak > nul

:: Start Node.js Backend in new window  
echo [2/3] Starting Node.js Backend on port 3001...
start "Backend" cmd /k "cd /d \"%~dp0backend\" && npm run dev"

:: Wait for backend to start
timeout /t 3 /nobreak > nul

:: Start React Frontend in new window
echo [3/3] Starting React Frontend on port 5173...
start "Frontend" cmd /k "cd /d \"%~dp0frontend\" && npm run dev"

echo.
echo ==================================================
echo   All services starting in separate windows...
echo ==================================================
echo.
echo   AI Service:  http://localhost:8000
echo   Backend API:  http://localhost:3001
echo   Frontend UI:  http://localhost:5173
echo.
echo   Test the health endpoint:
echo   http://localhost:3001/api/ai-quiz/health
echo.
echo Press any key to close this window...
pause > nul
