@echo off
title LyricSync Launcher
echo ===================================
echo   LyricSync - Per-Word SRT Generator
echo ===================================
echo.

:: Kill any running instances
echo Closing existing instances...
C:\Windows\System32\taskkill.exe /F /IM "electron.exe" >nul 2>&1
timeout /t 1 /nobreak >nul
echo Done!
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies [first run]...
    echo This may take a minute...
    echo.
    call npm install
    echo.
    echo Dependencies installed!
    echo.
)

echo Starting LyricSync...
echo.
call npx electron .
