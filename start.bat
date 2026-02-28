@echo off
echo ===================================
echo   LyricSync - Per-Word SRT Generator
echo ===================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    echo.
    call npm install
    echo.
    echo Dependencies installed!
    echo.
)

echo Starting LyricSync...
echo.
call npx electron .
