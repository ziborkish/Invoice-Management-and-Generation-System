@echo off
title Rekinu Sistema
cd /d "%~dp0"

echo ==========================================
echo     Rekinu sistemas inicializacija...     
echo ==========================================

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo KLUDA: Node.js nav atrasts!
    echo Ludzu, lejupielade un uzinstale Node.js no https://nodejs.org/
    pause
    exit
)

echo Parbauda nepieciesamas pakotnes...
call npm install express multer pdf-parse

echo Palaiz serveri un atver parlukprogrammu...
start http://localhost:3000
node server.js
pause