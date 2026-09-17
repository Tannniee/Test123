@echo off
title PoE Quick Price Checker
chcp 65001 > nul

echo ========================================================
echo        PoE Ninja Quick Price Checker (PoE 1 ^& 2)
echo        Cache tu dong moi 30 phut - Instant Search
echo ========================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may cua ban!
    echo Vui long cai dat Node.js tu https://nodejs.org
    pause
    exit /b
)

:: Check node_modules
if not exist "node_modules" (
    echo [1/2] Dang cai dat thu vien can thiet...
    call npm.cmd install
)

echo [2/2] Dang khoi dong ung dung...
echo Ung dung se chay tai dia chi: http://localhost:3000
echo.

:: Mo trinh duyet sau 2 giay
start "" http://localhost:3000

:: Chay server Node
node server.js

pause
